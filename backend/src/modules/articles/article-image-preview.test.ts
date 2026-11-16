import assert from 'node:assert/strict';
import { test } from 'node:test';
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createImagePreviewInspector, getArticleImagePreview } from './article-image-preview';

const root = 'https://storage.example/storage/v1/object/public/paragon-media/';
const source = `${root}media/first/large.webp`;
const config = { apiBase: 'https://api.example', storageBase: 'https://storage.example', bucket: 'paragon-media' };
const id = 'e8ab4c04-231d-4f09-acc2-c20fc7c5ae91';
const apiImage = `${config.apiBase}/api/media/${id}/file`;
const fixture = (format: 'jpeg' | 'png' | 'webp' = 'webp') =>
  sharp({ create: { width: 1200, height: 630, channels: 3, background: '#000035' } }).toFormat(format).toBuffer();
const response = (bytes: Buffer) => new Response(new Uint8Array(bytes));

test('real raster bytes determine dimensions and type, including EXIF orientation', async () => {
  for (const format of ['jpeg', 'png', 'webp'] as const) {
    const bytes = await fixture(format);
    const inspect = createImagePreviewInspector({ fetcher: async (_url, options) => {
      assert.equal(options?.redirect, 'error');
      assert.ok(options?.signal instanceof AbortSignal);
      assert.deepEqual(options?.headers, { Accept: 'image/jpeg,image/png,image/webp,image/gif' });
      return response(bytes);
    } });
    assert.deepEqual(await inspect(source, root), { image: source, imageWidth: 1200, imageHeight: 630, imageType: `image/${format}` });
  }
  const rotated = await sharp({ create: { width: 80, height: 120, channels: 3, background: 'navy' } })
    .jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const inspect = createImagePreviewInspector({ fetcher: async () => response(rotated) });
  const result = await inspect(source, root);
  assert.equal(result?.imageWidth, 120); assert.equal(result?.imageHeight, 80);
});

test('the declared fallback dimensions match the actual deployed asset bytes', async () => {
  const bytes = await readFile(resolve(__dirname, '../../../../frontend/ParagonWebApp/src/assets/paragon-social-preview.jpg'));
  const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.width, 1424); assert.equal(metadata.height, 752); assert.equal(metadata.format, 'jpeg');
});

test('excessive declared JPEG dimensions are rejected without allocating a decoded image', async () => {
  const bytes = await fixture('jpeg');
  const frame = bytes.indexOf(Buffer.from([0xff, 0xc0]));
  assert.ok(frame > 0);
  bytes.writeUInt16BE(7000, frame + 5); bytes.writeUInt16BE(7000, frame + 7);
  const inspect = createImagePreviewInspector({ fetcher: async () => response(bytes) });
  assert.equal(await inspect(source, root), null);
});

test('resolves only exact managed media and safe public storage paths', async () => {
  let lookups = 0;
  const lookup = async (value: string) => { lookups++; assert.equal(value, id); return { fileType: 'image', filePath: 'media/first/large.webp', updatedAt: 'version-2' }; };
  let probes = 0;
  const inspect = async (url: string, publicRoot: string, version = '') => {
    probes++; assert.equal(url, source); assert.equal(publicRoot, root);
    if (lookups) assert.equal(version, 'version-2');
    return { image: url, imageWidth: 1200, imageHeight: 630, imageType: 'image/webp' };
  };
  assert.equal((await getArticleImagePreview(source, config, lookup, inspect))?.image, source);
  assert.equal((await getArticleImagePreview(apiImage, config, lookup, inspect))?.image, source);
  assert.equal(lookups, 1); assert.equal(probes, 2);
  for (const bad of [apiImage.replace('api.example', 'evil.example'), apiImage.replace('api.example', 'api.example.evil.com'),
    apiImage.replace('https://', 'https://user:pass@'), `${apiImage}?token=private`, `${apiImage}#fragment`,
    apiImage.replace('api.example', 'api.example:444'), 'http://127.0.0.1/image', `${root}private/secret.jpg`,
    source.replace('storage.example', 'storage.example.evil.com'), source.replace('/media/', '/media%2f'),
    apiImage.replace('/file', '%2ffile')]) {
    assert.equal(await getArticleImagePreview(bad, config, lookup, inspect), null, bad);
  }
  assert.equal(lookups, 1); assert.equal(probes, 2);
  for (const path of ['../private.jpg', 'media/../private.jpg', 'media/%2e%2e/private.jpg', 'https://evil.example/image.jpg']) {
    assert.equal(await getArticleImagePreview(apiImage, config, async () => ({ fileType: 'image', filePath: path }), inspect), null);
  }
  assert.equal(probes, 2);
  assert.equal(await getArticleImagePreview(apiImage, config, lookup, async () => { throw new Error('Optional probe failed'); }), null);
});

test('inspector rejects untrusted destinations before any network request', async () => {
  let calls = 0;
  const inspect = createImagePreviewInspector({ fetcher: async () => { calls++; throw new Error('No request allowed'); } });
  for (const url of [source.replace('storage.example', 'attacker.example'), source.replace('https:', 'http:'),
    source.replace('https://', 'https://user:pass@'), `${source}?redirect=private`, `${root}private/image.jpg`]) {
    assert.equal(await inspect(url, root), null);
  }
  assert.equal(calls, 0);
});

test('unsupported, oversized, failed and malformed images degrade without caching a permanent failure', async () => {
  const good = await fixture();
  let now = 0;
  for (const factory of [() => new Response(null, { status: 302 }), () => new Response('HTML, not an image'),
    () => new Response(new Uint8Array(2 * 1024 * 1024 + 1)), () => new Response(null, { status: 500 }),
    () => { throw new DOMException('Timeout', 'TimeoutError'); }]) {
    let calls = 0;
    const inspect = createImagePreviewInspector({ now: () => now, fetcher: async () => ++calls === 1 ? factory() : response(good) });
    assert.equal(await inspect(source, root), null);
    assert.equal(await inspect(source, root), null);
    assert.equal(calls, 1);
    now += 30_001;
    assert.equal((await inspect(source, root))?.imageWidth, 1200);
    assert.equal(calls, 2);
  }
});

test('deduplicates probes, bounds active work and releases capacity after errors', async () => {
  const bytes = await fixture();
  const releases: Array<() => void> = [];
  let calls = 0;
  const inspect = createImagePreviewInspector({ fetcher: async () => {
    calls++;
    await new Promise<void>(resolve => releases.push(resolve));
    return response(bytes);
  } });
  const first = inspect(source, root);
  const same = inspect(source, root);
  const others = [1, 2, 3].map(n => inspect(`${root}media/image-${n}.webp`, root));
  assert.equal(await inspect(`${root}media/excess.webp`, root), null);
  assert.equal(calls, 4);
  releases.splice(0).forEach(release => release());
  await Promise.all([first, same, ...others]);
  const next = inspect(`${root}media/next.webp`, root);
  releases.splice(0).forEach(release => release());
  assert.equal((await next)?.imageWidth, 1200);
  assert.equal(calls, 5);
});

test('streamed byte limits cancel oversized responses without trusting Content-Length', async () => {
  let cancelled = false;
  const inspect = createImagePreviewInspector({ fetcher: async () => new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)); },
    cancel() { cancelled = true; },
  }), { headers: { 'content-length': '1' } }) });
  assert.equal(await inspect(source, root), null);
  assert.equal(cancelled, true);
});

test('a stalled image body is aborted within the probe budget', async () => {
  const started = Date.now();
  const inspect = createImagePreviewInspector({ fetcher: async (_url, options) => new Response(new ReadableStream({
    start(controller) {
      const keepAlive = setTimeout(() => controller.error(new Error('Timeout did not fire')), 4000);
      options?.signal?.addEventListener('abort', () => {
        clearTimeout(keepAlive);
        controller.error(new DOMException('Aborted', 'AbortError'));
      }, { once: true });
    },
  })) });
  assert.equal(await inspect(source, root), null);
  assert.ok(Date.now() - started < 3500);
});

test('cache is bounded, expires and tracks image replacement versions', async () => {
  const bytes = await fixture();
  let calls = 0; let now = 0;
  const inspect = createImagePreviewInspector({ now: () => now, fetcher: async () => { calls++; return response(bytes); } });
  await inspect(source, root, 'old');
  await inspect(source, root, 'old'); assert.equal(calls, 1);
  await inspect(source, root, 'new'); assert.equal(calls, 2);
  now = 15 * 60_000 + 1;
  await inspect(source, root, 'new'); assert.equal(calls, 3);
  for (let n = 0; n < 128; n++) await inspect(`${root}media/cache-${n}.webp`, root);
  await inspect(source, root, 'new'); assert.equal(calls, 132);
});
