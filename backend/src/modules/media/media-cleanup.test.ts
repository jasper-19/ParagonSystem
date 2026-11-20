import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import db from '../../config/db';
import { storageService } from '../../storage/storage.factory';
import { uploadMediaObjects, deleteMedia } from './media.service';
import { mediaStoragePaths } from './media-storage-paths';
import { remove } from './media.repository';

afterEach(() => mock.restoreAll());
after(() => db.end());
const path = 'media/11111111-1111-4111-8111-111111111111/large.webp';

function cleanupDatabase(events: string[], options: { failQueue?: boolean; referenced?: boolean; expired?: boolean } = {}) {
  mock.method(db, 'connect', async () => ({
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.startsWith('INSERT')) {
        events.push('queue');
        if (options.failQueue) throw new Error('queue unavailable');
      }
      if (sql.startsWith('SELECT storage_path')) {
        assert.match(sql, /attempts = 1 FOR UPDATE/);
        return { rows: options.expired ? [] : (params[0] as string[]).map(storage_path => ({ storage_path })) };
      }
      return { rows: sql.startsWith('SELECT') && options.referenced ? [{ exists: 1 }] : [] };
    },
    release: () => {},
  }));
}

test('partial uploads settle before compensation, and every object gets retry intent', async () => {
  const events: string[] = [];
  cleanupDatabase(events);
  let finish: (() => void) | undefined;
  let started: (() => void) | undefined;
  const uploadStarted = new Promise<void>(resolve => { started = resolve; });
  mock.method(storageService, 'upload', async (key: string) => {
    if (key === 'first') throw new Error('upload failed');
    await new Promise<void>(resolve => { finish = resolve; started!(); });
    events.push('late-upload-finished');
  });
  mock.method(storageService, 'remove', async (keys: string[]) => { events.push('remove:' + keys[0]); });
  const result = uploadMediaObjects(['first', 'second'].map(path => ({ path, buffer: Buffer.from('x'), contentType: 'image/webp' })),
    async () => { throw new Error('Metadata must not be created'); });
  await uploadStarted;
  assert.deepEqual(events, ['queue']);
  finish!();
  await assert.rejects(result, /upload failed/);
  assert.deepEqual(events, ['queue', 'late-upload-finished', 'remove:first', 'remove:second']);
});

test('an unavailable or already claimed recovery reservation prevents external writes', async () => {
  for (const options of [{ failQueue: true }, { expired: true }]) {
    const events: string[] = [];
    cleanupDatabase(events, options);
    mock.method(storageService, 'upload', async () => { events.push('upload'); });
    mock.method(storageService, 'remove', async () => { events.push('remove'); });
    await assert.rejects(uploadMediaObjects([{ path, buffer: Buffer.from('x'), contentType: 'image/webp' }], async () => ({})));
    assert.deepEqual(events, ['queue']);
    mock.restoreAll();
  }
});

test('metadata failure compensates successful uploads; uncertain committed metadata protects objects', async () => {
  for (const referenced of [false, true]) {
    const events: string[] = [];
    cleanupDatabase(events, { referenced });
    mock.method(storageService, 'upload', async () => {});
    mock.method(storageService, 'remove', async () => { events.push('remove'); });
    await assert.rejects(uploadMediaObjects([{ path, buffer: Buffer.from('x'), contentType: 'image/webp' }],
      async () => { throw new Error('metadata failed'); }), /metadata failed/);
    assert.deepEqual(events, referenced ? ['queue'] : ['queue', 'remove']);
    mock.restoreAll();
  }
});

test('generated layouts expand to all variants, arbitrary legacy paths do not', () => {
  assert.equal(mediaStoragePaths(path).length, 3);
  assert.deepEqual(mediaStoragePaths('legacy/large.webp'), ['legacy/large.webp']);
});

test('concurrent uploads preserve pool capacity and release admission slots', async () => {
  cleanupDatabase([]);
  const releases: Array<() => void> = [];
  mock.method(storageService, 'upload', async () => {
    await new Promise<void>(resolve => { releases.push(resolve); });
  });
  const object = { path, buffer: Buffer.from('x'), contentType: 'image/webp' };
  const limit = Math.max(1, Math.min(2, Number(db.options.max ?? 5) - 1));
  const pending = Array.from({ length: limit }, () => uploadMediaObjects([object], async () => 'created'));
  await assert.rejects(uploadMediaObjects([object], async () => 'unexpected'), (error: any) => error.statusCode === 503);
  // Let acquisition and reservation queries reach the controlled upload promises.
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(releases.length, limit);
  releases.forEach(release => release());
  assert.deepEqual(await Promise.all(pending), Array(limit).fill('created'));
  mock.method(storageService, 'upload', async () => {});
  assert.equal(await uploadMediaObjects([object], async () => 'next'), 'next');
});

function deletionDatabase(events: string[], failQueue = false) {
  mock.method(db, 'connect', async () => ({
    query: async (sql: string, params: unknown[] = []) => {
      if (sql.includes('FROM articles')) return { rows: [] };
      if (sql.startsWith('DELETE')) { events.push('delete-row'); return { rows: [{ id: 'id', storage_path: path }] }; }
      if (sql.includes('INSERT INTO paragon_internal.storage_cleanup_jobs')) {
        events.push('queue');
        assert.deepEqual(params, [mediaStoragePaths(path)]);
        if (failQueue) throw new Error('queue failed');
      }
      if (sql === 'COMMIT' || sql === 'ROLLBACK') events.push(sql);
      return { rows: [] };
    }, release: () => {},
  }));
}

test('deletion and all variant retry jobs commit together; queue failure rolls back', async () => {
  const events: string[] = [];
  deletionDatabase(events);
  await remove('id');
  assert.deepEqual(events, ['delete-row', 'queue', 'COMMIT']);
  mock.restoreAll(); events.length = 0;
  deletionDatabase(events, true);
  await assert.rejects(remove('id'), /queue failed/);
  assert.deepEqual(events, ['delete-row', 'queue', 'ROLLBACK']);
});

test('storage failure after deletion is retryable and does not report the committed deletion as failed', async () => {
  const events: string[] = [];
  deletionDatabase(events);
  let calls = 0;
  mock.method(storageService, 'remove', async () => { calls++; throw new Error('storage unavailable'); });
  await deleteMedia('id');
  assert.equal(calls, 3);
  assert.ok(events.includes('queue'));
});
