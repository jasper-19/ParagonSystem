import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import db from '../config/db';
import { removeUnreferencedStorageObject } from './storage-cleanup.repository';

afterEach(()=>mock.restoreAll()); after(()=>db.end());

test('cleanup locks reference tables and rechecks references before storage deletion',async()=>{
  const events:string[]=[];
  mock.method(db,'connect',async()=>({query:async(sql:string,params?:unknown[])=>{
    events.push(sql.startsWith('SELECT')?'reference-check':sql);
    if(sql.startsWith('SELECT')) assert.deepEqual(params,['private-key']);
    return {rows:[]};
  },release:()=>events.push('release')}));
  assert.equal(await removeUnreferencedStorageObject('private-key',async()=>{events.push('delete');}),true);
  assert.deepEqual(events,['BEGIN',"SET LOCAL lock_timeout = '5s'","SET LOCAL idle_in_transaction_session_timeout = '120s'",'LOCK TABLE special_issues, media_files IN SHARE ROW EXCLUSIVE MODE',
    'reference-check','delete','COMMIT','release']);
});

test('a reference appearing after job claim protects the file from deletion',async()=>{
  let deleted=false;
  mock.method(db,'connect',async()=>({query:async(sql:string)=>({rows:sql.startsWith('SELECT')?[{exists:1}]:[]}),release:()=>{}}));
  assert.equal(await removeUnreferencedStorageObject('active-key',async()=>{deleted=true;}),false);
  assert.equal(deleted,false);
});

test('storage failure rolls back and releases metadata locks for safe retry',async()=>{
  const events:string[]=[];
  mock.method(db,'connect',async()=>({query:async(sql:string)=>{events.push(sql);return {rows:[]};},release:()=>events.push('release')}));
  await assert.rejects(removeUnreferencedStorageObject('key',async()=>{throw new Error('Storage failed');}),/Storage failed/);
  assert.deepEqual(events.slice(-2),['ROLLBACK','release']);
});
