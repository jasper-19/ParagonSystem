import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createPrivatePdfHandler, parsePdfRange } from './private-pdf.controller';
import { errorHandler } from '../../middlewares/errorHandler';
import { privatePdfKey } from '../../storage/private-pdf-path';
import { exactPdfBytes } from '../../storage/pdf-stream';
import { pipeline } from 'node:stream/promises';
import { Writable } from 'node:stream';

const id = '11111111-1111-4111-8111-111111111111';
const bytes = Buffer.from('%PDF-1.7\nprivate-test\n%%EOF');
const sha256 = 'a'.repeat(64);

test('private delivery checks visibility before GET/HEAD/ranges and conditional requests', async () => {
  let status = 'draft'; let admin = false; let reads = 0;
  const handler = createPrivatePdfHandler({
    lookup: async key => { assert.equal(key, privatePdfKey(id)); return { status, size: bytes.length, sha256 }; },
    authorize: async token => { assert.equal(token, 'test-token'); return admin; },
    storage: { read: async (_key, range) => { reads++; return Readable.from([bytes.subarray(range.start, range.end + 1)]); } },
  });
  const app = express(); app.get('/pdf/:id', handler); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/pdf/${id}`;
  try {
    for (const method of ['GET','HEAD']) {
      const denied = await fetch(url, { method, headers: { Range: 'bytes=0-4', 'If-None-Match': `"${sha256}"` } });
      assert.equal(denied.status, 404); assert.match(denied.headers.get('cache-control')!, /no-store/);
    }
    assert.equal(reads, 0);
    admin = true;
    const preview = await fetch(url, { headers: { Authorization: 'Bearer test-token' } });
    assert.equal(preview.status, 200); assert.deepEqual(Buffer.from(await preview.arrayBuffer()), bytes);
    const cookiePreview = await fetch(url, { headers: { Cookie: 'paragon_session=test-token' } });
    assert.equal(cookiePreview.status, 200); await cookiePreview.arrayBuffer();
    admin = false;
    assert.equal((await fetch(url, { headers: { Authorization: 'Bearer test-token' } })).status, 404);
    assert.equal((await fetch(url, { method: 'HEAD', headers: { Cookie: 'paragon_session=test-token' } })).status, 404);
    status = 'published';
    const full = await fetch(url); assert.equal(full.status, 200);
    assert.equal(full.headers.get('content-type'), 'application/pdf'); assert.equal(full.headers.get('location'), null);
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    for (const [header, start, end] of [['bytes=0-4',0,4], ['bytes=5-',5,bytes.length-1], ['bytes=-4',bytes.length-4,bytes.length-1]] as const) {
      const partial = await fetch(url, { headers: { Range: header } });
      assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-range'), `bytes ${start}-${end}/${bytes.length}`);
      assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(start, end+1));
      assert.match(partial.headers.get('cache-control')!, /no-store/);
    }
    for (const range of ['bytes=9999-', 'bytes=0-1,3-4', 'bytes=-0', 'garbage', 'bytes=5-2']) {
      const invalid = await fetch(url, { headers: { Range: range } }); assert.equal(invalid.status, 416);
      assert.equal(invalid.headers.get('content-range'), `bytes */${bytes.length}`);
    }
    const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200);
    assert.equal(await head.text(), ''); assert.equal(head.headers.get('content-length'), String(bytes.length));
    const conditional = await fetch(url, { headers: { 'If-None-Match': `"${sha256}"` } });
    assert.equal(conditional.status, 200); await conditional.arrayBuffer();
    const staleRange = await fetch(url, { headers: { Range: 'bytes=0-4', 'If-Range': 'stale' } });
    assert.equal(staleRange.status, 200); await staleRange.arrayBuffer();
    status = 'archived';
    assert.equal((await fetch(url, { method: 'HEAD' })).status, 404);
    assert.equal((await fetch(url, { headers: { 'If-None-Match': `"${sha256}"` } })).status, 404);
    assert.equal((await fetch(url.replace(id, 'not-an-id'))).status, 404);
  } finally {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('range parser rejects unsafe integers and clamps valid ranges', () => {
  assert.equal(parsePdfRange('bytes=9007199254740993-', 100), null);
  assert.deepEqual(parsePdfRange('bytes=0-999', 10), { start: 0, end: 9 });
  assert.deepEqual(parsePdfRange('bytes=-999', 10), { start: 0, end: 9 });
});

test('stream accounting rejects both excess and truncated upstream data', async () => {
  const sink = () => new Writable({ write(_chunk, _encoding, done) { done(); } });
  await assert.rejects(pipeline(Readable.from([Buffer.alloc(11)]), exactPdfBytes(10), sink()), /response size/);
  await assert.rejects(pipeline(Readable.from([Buffer.alloc(9)]), exactPdfBytes(10), sink()), /Incomplete/);
});

test('delivery caps concurrent streams and cancels upstream work on client disconnect', async () => {
  let aborted = 0;
  let streamCount = 0;
  const handler = createPrivatePdfHandler({ lookup: async () => ({ status: 'published', size: 100, sha256 }),
    authorize: async () => false, storage: { read: async (_key, _range, _size, signal) => {
      streamCount++;
      const source = new Readable({ read() {} });
      signal.addEventListener('abort', () => { aborted++; }, { once: true });
      source.push(Buffer.from('a')); // headers delivered, remainder deliberately stalls
      return source;
    } },
  });
  const app=express(); app.get('/pdf/:id',handler); app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1'); await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/pdf/${id}`;
  const clients=Array.from({length:8},()=>new AbortController());
  try {
    const open=await Promise.all(clients.map(controller=>fetch(url,{signal:controller.signal})));
    open.forEach(response=>assert.equal(response.status,200));
    const busy=await fetch(url); assert.equal(busy.status,503); assert.equal(streamCount,8);
    assert.deepEqual(await busy.json(),{error:'PDF delivery is busy'});
    clients.forEach(controller=>controller.abort());
    await new Promise<void>((resolve,reject)=>{
      const timeout=setTimeout(()=>{clearInterval(poll);reject(new Error('Client disconnect did not abort upstream'));},2000);
      const poll=setInterval(()=>{if(aborted===8){clearTimeout(timeout);clearInterval(poll);resolve();}},10);
    });
  } finally {
    clients.forEach(controller=>controller.abort()); server.closeAllConnections();
    await new Promise<void>(resolve=>server.close(()=>resolve()));
  }
});

test('upstream failures return generic uncached errors and release admission slots',async()=>{
  const handler=createPrivatePdfHandler({lookup:async()=>({status:'published',size:10,sha256}),
    authorize:async()=>false,storage:{read:async()=>{throw new Error('secret-provider-details');}}});
  const app=express();app.get('/pdf/:id',handler);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/pdf/${id}`;
  try {
    for(let i=0;i<10;i++){
      const response=await fetch(url);assert.equal(response.status,503);
      assert.match(response.headers.get('cache-control')!,/no-store/);
      assert.deepEqual(await response.json(),{error:'Internal server error'});
    }
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test('a stalled response aborts at its finite deadline', async () => {
  let aborted=false;
  const handler=createPrivatePdfHandler({lookup:async()=>({status:'published',size:100,sha256}),
    authorize:async()=>false,storage:{read:async(_key,_range,_size,signal)=>{
      signal.addEventListener('abort',()=>{aborted=true;},{once:true});
      const source=new Readable({read(){}});source.push(Buffer.from('a'));return source;
    }}},{timeoutMs:100});
  const app=express();app.get('/pdf/:id',handler);app.use(errorHandler);
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  try {
    const url=`http://127.0.0.1:${(server.address() as AddressInfo).port}/pdf/${id}`;
    await assert.rejects(async()=>{
      const response=await fetch(url,{signal:AbortSignal.timeout(2000)});await response.arrayBuffer();
    });
    assert.equal(aborted,true);
  } finally {server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
