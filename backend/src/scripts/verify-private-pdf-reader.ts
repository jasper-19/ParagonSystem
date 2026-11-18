import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

process.env.DB_HOST='127.0.0.1';process.env.DB_NAME='private_pdf_reader_test';process.env.DB_USER='test';process.env.DB_PASSWORD='synthetic';process.env.NODE_ENV='test';process.env.SUPABASE_URL='https://storage.example';process.env.SUPABASE_SERVICE_ROLE_KEY='synthetic-key';
const express=require('express');
const {createPrivatePdfHandler}=require('../modules/special-issues/private-pdf.controller');
const {LocalPrivatePdfStorage}=require('../storage/private-pdf-storage');
const {privatePdfKey}=require('../storage/private-pdf-path');
const pool=require('../config/db').default;
async function main(){
  const pdf=await import(pathToFileURL(path.resolve('../frontend/ParagonWebApp/node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
  const appRequire=createRequire(path.resolve('../frontend/ParagonWebApp/package.json'));
  const {createCanvas}=appRequire('@napi-rs/canvas');
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 72 72] /Contents 4 0 R /Resources << >> >>',
    '<< /Length 25 >>\nstream\n0 0 1 rg 0 0 72 72 re f\nendstream'];
  let source='%PDF-1.4\n';const offsets:number[]=[];
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(source));source+=`${i+1} 0 obj\n${object}\nendobj\n`;});
  source+='% harmless padding for range validation\n'.repeat(15000);
  const xref=Buffer.byteLength(source);
  source+=`xref\n0 5\n0000000000 65535 f \n${offsets.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes=Buffer.from(source);const sha256=createHash('sha256').update(bytes).digest('hex');
  const root=await mkdtemp(path.join(os.tmpdir(),'paragon-private-reader-'));
  const store=new LocalPrivatePdfStorage(root);const id='11111111-1111-4111-8111-111111111111';
  await store.upload(privatePdfKey(id),bytes,{contentType:'application/pdf'});
  let ranges=0;
  const app=express();app.get('/api/special-issues/pdf/:id',createPrivatePdfHandler({
    lookup:async()=>({status:'published',size:bytes.length,sha256}),authorize:async()=>false,
    storage:{read:async(key:any,range:any,size:any,signal:any)=>{if(range.end-range.start+1<size)ranges++;return store.read(key,range,size,signal);}},
  }));
  const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
  let task:any;
  try{
    task=pdf.getDocument({url:`http://127.0.0.1:${server.address().port}/api/special-issues/pdf/${id}`,
      disableRange:false,disableStream:true,disableAutoFetch:true,rangeChunkSize:65536});
    const document=await task.promise;const page=await document.getPage(1);const viewport=page.getViewport({scale:1});
    const canvas=createCanvas(viewport.width,viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const pixel=canvas.getContext('2d').getImageData(30,30,1,1).data;
    assert.equal(pixel[2],255);assert.equal(pixel[0],0);assert.ok(ranges>0);
    console.log(`PDF.js ${pdf.version} rendered a private-store PDF through the API; ${ranges} range reads; expected pixel verified.`);
  }finally{await task?.destroy();server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(root,{recursive:true,force:true});await pool.end();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
