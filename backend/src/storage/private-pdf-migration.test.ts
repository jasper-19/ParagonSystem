import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import test from 'node:test';
import { migratePrivatePdf, MigrationPdf, MigrationDependencies } from './private-pdf-migration';

const id='11111111-1111-4111-8111-111111111111';
const bytes=Buffer.from('%PDF-test-migration');
const record: MigrationPdf={id,storagePath:`special-issues/${id}/${id}.pdf`,pdfUrl:'https://legacy.example/original.pdf',
  size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};

test('migration verifies both copies before CAS and never deletes originals',async()=>{
  const calls:string[]=[];
  const deps:MigrationDependencies={
    readSource:async()=>{calls.push('source');return Readable.from([bytes]);},
    upload:async()=>{calls.push('copy');},
    readPrivate:async()=>{calls.push('verify');return Readable.from([bytes]);},
    swap:async(old,key,url)=>{calls.push('cas');assert.equal(old,record);assert.match(key,/^private-special-issues\//);assert.match(url,/\/api\/special-issues\/pdf\//);return true;},
  };
  assert.equal(await migratePrivatePdf(record,deps),true);
  assert.deepEqual(calls,['source','copy','verify','cas']);
  deps.upload=async()=>{throw new Error('Already exists');};
  deps.swap=async()=>false; // concurrent edit is preserved; existing copy can be verified on retry
  assert.equal(await migratePrivatePdf(record,deps),false);
});

test('checksum failure, truncated source and untrusted paths cannot replace references',async()=>{
  let changed=false; let copied=false;
  const deps:MigrationDependencies={readSource:async()=>Readable.from([bytes]),upload:async()=>{copied=true;},
    readPrivate:async()=>Readable.from([Buffer.alloc(bytes.length)]),swap:async()=>{changed=true;return true;}};
  await assert.rejects(migratePrivatePdf(record,deps),/Private PDF checksum/);
  assert.equal(changed,false);assert.equal(copied,true);
  copied=false;
  await assert.rejects(migratePrivatePdf({...record,sha256:'f'.repeat(64)},deps),/Source PDF checksum/);
  assert.equal(copied,false);
  deps.readSource=async()=>Readable.from([Buffer.alloc(2)]);
  await assert.rejects(migratePrivatePdf(record,deps),/Incomplete/);
  await assert.rejects(migratePrivatePdf({...record,storagePath:'https://untrusted.example/a.pdf'},deps),/manual migration/);
  assert.equal(changed,false);
});
