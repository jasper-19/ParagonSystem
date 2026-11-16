import sharp from 'sharp';
import * as mediaRepository from '../media/media.repository';

const MAX_BYTES = 2 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
const MAX_ENTRIES = 128;
const MAX_PENDING = 4;
const MIME_TYPES: Record<string, string> = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
};
type ImageInfo = { image: string; imageWidth: number; imageHeight: number; imageType: string };
type ManagedMedia = { fileType: string; filePath: string; updatedAt?: string | undefined };

function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash ? url : null;
  } catch { return null; }
}

function isMediaPath(path: string): boolean {
  return /^media\/[a-zA-Z0-9_./-]+$/.test(path)
    && path.split('/').every(part => part && part !== '.' && part !== '..');
}

function isPublicImage(url: URL, root: URL): boolean {
  return url.origin === root.origin && url.pathname.startsWith(root.pathname)
    && isMediaPath(url.pathname.slice(root.pathname.length));
}

/** Public objects only; credentials and caller-supplied destinations never enter fetch. */
export function createImagePreviewInspector({ fetcher = fetch, now = Date.now } = {}) {
  const cache = new Map<string, { value: ImageInfo | null; expires: number }>();
  const pending = new Map<string, Promise<ImageInfo | null>>();
  return async (source: string, publicRoot: string, version = ''): Promise<ImageInfo | null> => {
    const url = safeUrl(source);
    const root = safeUrl(publicRoot);
    if (!url || !root || !isPublicImage(url, root)) return null;
    const key = `${url.href}|${version}`;
    const cached = cache.get(key);
    if (cached && cached.expires > now()) {
      cache.delete(key); cache.set(key, cached);
      return cached.value;
    }
    cache.delete(key);
    const existing = pending.get(key);
    if (existing) return existing;
    // No queue: distinct cold requests cannot allocate unbounded pending work.
    if (pending.size >= MAX_PENDING) return null;
    const job = (async (): Promise<ImageInfo | null> => {
      let value: ImageInfo | null = null;
      try {
        const response = await fetcher(url.href, {
          headers: { Accept: 'image/jpeg,image/png,image/webp,image/gif' },
          redirect: 'error', signal: AbortSignal.timeout(2000),
        });
        if (!response.ok || !response.body) {
          await response.body?.cancel();
          throw new Error('Image unavailable');
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Image too large'); }
            chunks.push(chunk.value);
          }
        } finally { reader.releaseLock(); }
        const metadata = await sharp(Buffer.concat(chunks), { limitInputPixels: MAX_PIXELS }).metadata();
        const mime = MIME_TYPES[metadata.format ?? ''];
        const width = metadata.autoOrient.width;
        const height = metadata.autoOrient.height;
        if (!mime || !Number.isInteger(width) || !Number.isInteger(height)
          || width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error('Unsupported image');
        value = { image: url.href, imageWidth: width, imageHeight: height, imageType: mime };
      } catch { /* Optional enrichment must never prevent the article preview. */ }
      cache.set(key, { value, expires: now() + (value ? 15 * 60_000 : 30_000) });
      while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      return value;
    })();
    pending.set(key, job);
    try { return await job; } finally { pending.delete(key); }
  };
}

const inspectImage = createImagePreviewInspector();

/** Resolve publication media only after the article's published-only lookup. */
export async function getArticleImagePreview(image: string | null | undefined,
  config = {
    apiBase: process.env.API_BASE_URL ?? '',
    storageBase: process.env.SUPABASE_URL ?? '',
    bucket: process.env.SUPABASE_STORAGE_BUCKET || 'paragon-media',
  }, lookup: (id: string) => Promise<ManagedMedia | null> = mediaRepository.findById,
  inspect = inspectImage): Promise<ImageInfo | null> {
  try {
    if (!image || !/^[a-zA-Z0-9_-]+$/.test(config.bucket)) return null;
    const storage = safeUrl(config.storageBase);
    const candidate = safeUrl(image);
    if (!storage || storage.pathname !== '/' || !candidate) return null;
    const root = new URL(`/storage/v1/object/public/${config.bucket}/`, storage);
    if (isPublicImage(candidate, root)) return await inspect(candidate.href, root.href);
    const api = safeUrl(config.apiBase);
    const id = candidate.pathname.match(/^\/api\/media\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\/file$/i)?.[1];
    if (!api || candidate.origin !== api.origin || !id) return null;
    const media = await lookup(id);
    if (!media || media.fileType !== 'image' || !isMediaPath(media.filePath)) return null;
    const source = new URL(media.filePath, root);
    if (!isPublicImage(source, root)) return null;
    return await inspect(source.href, root.href, media.updatedAt ?? '');
  } catch { return null; }
}
