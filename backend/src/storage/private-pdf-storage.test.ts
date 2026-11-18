import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { AddressInfo } from 'node:net';
import { afterEach, mock, test } from 'node:test';
import express from 'express';
import { privatePdfKey, privatePdfUrl, isPrivatePdfKey } from './private-pdf-path';
import { localUploadsMiddleware } from './local-uploads.middleware';

process.env.SUPABASE_URL = 'https://storage.example';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
const { RoutedStorageService, LocalPrivatePdfStorage, SupabasePrivatePdfStorage, readSupabasePdf } =
  require('./private-pdf-storage') as typeof import('./private-pdf-storage');

const id = '11111111-1111-4111-8111-111111111111';
const key = privatePdfKey(id);
afterEach(() => mock.restoreAll());

test('canonical private keys produce API URLs and cannot contain traversal or arbitrary URLs', () => {
  const before = process.env.API_BASE_URL; process.env.API_BASE_URL = 'https://api.example';
  try {
    assert.equal(privatePdfUrl(key), `https://api.example/api/special-issues/pdf/${id}`);
    for (const bad of ['../x', `private-special-issues/${id}/other.pdf`, `${key}?x=1`, `https://elsewhere/${key}`]) {
      assert.equal(isPrivatePdfKey(bad), false); assert.throws(() => privatePdfUrl(bad));
    }
  } finally { if (before === undefined) delete process.env.API_BASE_URL; else process.env.API_BASE_URL = before; }
});

test('routing keeps image uploads public and sends private uploads and mixed cleanup to correct adapters', async () => {
  const calls: string[] = [];
  const adapter = (name: string) => ({
    upload: async (key: string) => { calls.push(`${name}:upload:${key}`); },
    uploadFile: async (key: string) => { calls.push(`${name}:file:${key}`); },
    remove: async (keys: string[]) => { calls.push(`${name}:remove:${keys.join(',')}`); },
    getPublicUrl: (key: string) => `${name}:${key}`,
  });
  const storage = new RoutedStorageService(adapter('public'), adapter('private'));
  await storage.upload('media/photo.png', Buffer.alloc(1), { contentType: 'image/png' });
  await storage.uploadFile(key, '/unused', { contentType: 'application/pdf' });
  await storage.remove(['media/photo.png', key]);
  assert.deepEqual(calls, ['public:upload:media/photo.png',`private:file:${key}`,`private:remove:${key}`,'public:remove:media/photo.png']);
  await assert.rejects(storage.remove(['media/photo.png', 'private-special-issues/../file']), /unavailable/);
  assert.equal(calls.length, 4);
});

test('local private bytes support ranges and cannot be fetched through public static uploads', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'paragon-private-storage-'));
  const publicRoot = path.join(root, 'uploads');
  const store = new LocalPrivatePdfStorage(path.join(root, 'private'));
  const data = Buffer.from('%PDF-private-test');
  await store.upload(key, data, { contentType: 'application/pdf' });
  const stream = await store.read(key, { start: 2, end: 5 }, data.length, new AbortController().signal);
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual(Buffer.concat(chunks), data.subarray(2,6));
  // Deliberately misplaced copy must still be denied by static middleware.
  await mkdir(path.dirname(path.join(publicRoot, key)), { recursive: true });
  await writeFile(path.join(publicRoot, key), data);
  await writeFile(path.join(publicRoot, 'photo.png'), 'public-image');
  const app = express(); app.use('/uploads', localUploadsMiddleware(publicRoot));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/uploads`;
  try {
    assert.equal((await fetch(`${base}/${key}`)).status,404);
    assert.equal((await fetch(`${base}/${key.replace('private-', '%70rivate-')}`)).status,404);
    assert.equal((await fetch(`${base}/${key.replace('/', '%2F')}`)).status,404);
    assert.equal((await fetch(`${base}/${key.toUpperCase()}`)).status,404);
    assert.equal(await (await fetch(`${base}/photo.png`)).text(),'public-image');
  } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); await rm(root,{recursive:true,force:true}); }
});

test('public or missing private buckets fail closed before upload', async () => {
  for (const bucket of [null, { public: true }]) {
    let wrote = false;
    const client = { storage: { getBucket: async () => ({ data: bucket, error: null }), from: () => { wrote = true; } } };
    const store = new SupabasePrivatePdfStorage(client as any, 'test-private-pdfs');
    await assert.rejects(store.upload(key, Buffer.alloc(1), { contentType: 'application/pdf' }), /unavailable/);
    assert.equal(wrote,false);
  }
});

test('authenticated upstream requests use fixed origins, reject redirects/ignored ranges and validate exact lengths', async () => {
  const beforeUrl = process.env.SUPABASE_URL; const beforeKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.SUPABASE_URL='https://storage.example'; process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-service-key';
  try {
    const transport = async (input: any, init: any) => {
      assert.equal(String(input), `https://storage.example/storage/v1/object/authenticated/test-private-pdfs/${key}`);
      assert.equal(init.redirect,'error'); assert.equal(init.headers.Range,'bytes=2-4');
      assert.equal(init.headers.Authorization,'Bearer synthetic-service-key');
      return new Response(Buffer.from('abc'),{status:206,headers:{'Content-Length':'3','Content-Range':'bytes 2-4/10'}});
    };
    const stream = await readSupabasePdf('test-private-pdfs',key,{start:2,end:4},10,new AbortController().signal,transport as any);
    const chunks: Buffer[]=[]; for await(const c of stream) chunks.push(c);
    assert.equal(Buffer.concat(chunks).toString(),'abc');
    for (const response of [new Response('0123456789',{status:200,headers:{'Content-Length':'10'}}),
      new Response(null,{status:302,headers:{Location:'https://attacker.example'}}),
      new Response('abc',{status:206,headers:{'Content-Length':'3','Content-Range':'bytes 0-2/10'}})]) {
      await assert.rejects(readSupabasePdf('test-private-pdfs',key,{start:2,end:4},10,new AbortController().signal,
        (async()=>response) as any), /unavailable/);
    }
  } finally {
    if(beforeUrl===undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL=beforeUrl;
    if(beforeKey===undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=beforeKey;
  }
});
