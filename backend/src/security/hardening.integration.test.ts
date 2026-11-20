import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, mock, test } from 'node:test';
import { Pool } from 'pg';
import db from '../config/db';
import { updateUser } from '../modules/users/user.repository';
import * as applications from '../modules/applications/application.repository';
import { uploadMediaObjects } from '../modules/media/media.service';
import { create as createMedia, remove as removeMedia } from '../modules/media/media.repository';
import { storageService } from '../storage/storage.factory';
import { claimNextStorageCleanupJob, removeUnreferencedStorageObject } from '../storage/storage-cleanup.repository';

after(() => db.end());

test('isolated local PostgreSQL: admin concurrency, application state and durable media recovery',
  { skip: process.env.HARDENING_LOCAL_DB_TESTS !== '1' }, async t => {
    assert.notEqual(process.env.NODE_ENV, 'production');
    assert.ok(['127.0.0.1', 'localhost', '::1'].includes(String(db.options.host)));
    const schema = `hardening_test_${randomUUID().replace(/-/g, '')}`;
    assert.match(schema, /^hardening_test_[a-f0-9]{32}$/);
    const setup = await db.connect();
    const fixture = new Pool({ ...db.options, password: db.options.password, max: 5, options: `-c search_path=${schema},pg_catalog` });
    const rewrite = (sql: string) => sql.split('paragon_internal.').join(`${schema}.`);
    try {
      await setup.query(`CREATE SCHEMA ${schema}`);
      await fixture.query(`
        CREATE TABLE users (id text PRIMARY KEY, role text, is_active boolean, updated_at timestamptz, password_hash text);
        CREATE TABLE user_sessions (id text, user_id text, revoked_at timestamptz);
        CREATE TYPE application_status AS ENUM ('pending','interview_scheduled','interview_completed','accepted','rejected');
        CREATE TABLE applications (id text PRIMARY KEY, status application_status, interviewed boolean DEFAULT false,
          interview_date timestamptz, interview_notes text, assigned boolean DEFAULT false, assigned_section text, assigned_role text);
        CREATE TABLE media_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_path text, file_name text, disk_name text,
          file_type text, mime_type text, size bigint, width integer, height integer);
        CREATE TABLE articles (id text, title text, slug text, image text, status text, published_at timestamptz, created_at timestamptz);
        CREATE TABLE special_issues (pdf_storage_path text);
        CREATE TABLE storage_cleanup_jobs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), storage_path text, reason text,
          attempts integer DEFAULT 0, last_error text, created_at timestamptz DEFAULT NOW(), updated_at timestamptz DEFAULT NOW(), completed_at timestamptz);
        CREATE UNIQUE INDEX pending_path ON storage_cleanup_jobs(storage_path) WHERE completed_at IS NULL;
      `);
      mock.method(db, 'connect', async () => {
        const client = await fixture.connect();
        return { query: (sql: string, values?: unknown[]) => client.query(rewrite(sql), values),
          release: (discard?: boolean) => client.release(discard) };
      });
      mock.method(db, 'query', (sql: string, values?: unknown[]) => fixture.query(rewrite(sql), values));

      await t.test('two concurrent admin removals leave one active admin and revoke only the successful session', async () => {
        await fixture.query("INSERT INTO users VALUES ('a','admin',true,NULL,NULL), ('b','admin',true,NULL,NULL)");
        await fixture.query("INSERT INTO user_sessions VALUES ('sa','a',NULL), ('sb','b',NULL)");
        const results = await Promise.allSettled([updateUser('a', { isActive: false }), updateUser('b', { role: 'staff' })]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.statusCode, 409);
        assert.equal((await fixture.query("SELECT * FROM users WHERE role='admin' AND is_active")).rowCount, 1);
        assert.equal((await fixture.query('SELECT * FROM user_sessions WHERE revoked_at IS NOT NULL')).rowCount, 1);
      });

      await t.test('assignment versus rejection cannot leave a rejected application assigned', async () => {
        await fixture.query("INSERT INTO applications (id,status) VALUES ('app','accepted')");
        const results = await Promise.allSettled([
          applications.assignApplication('app', 'News', 'Writer'), applications.rejectApplication('app'),
        ]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        assert.equal((results.find(r => r.status === 'rejected') as PromiseRejectedResult).reason.statusCode, 409);
        const row = (await fixture.query("SELECT * FROM applications WHERE id='app'")).rows[0];
        assert.ok(!row.assigned || row.status === 'accepted');
        await fixture.query("INSERT INTO applications (id,status,interviewed,interview_date) VALUES ('cancel','interview_scheduled',true,NOW())");
        await applications.updateStatus('cancel', 'pending');
        const cancelled = (await fixture.query("SELECT * FROM applications WHERE id='cancel'")).rows[0];
        assert.equal(cancelled.interviewed, false);
        assert.equal(cancelled.interview_date, null);
      });

      await t.test('upload jobs survive failure, cannot be claimed in flight, and finish with committed metadata', async () => {
        const path = `media/${randomUUID()}/large.webp`;
        let failMetadata = true;
        mock.method(storageService, 'upload', async () => {
          // Age the visible job so the worker would claim it without the row lock.
          // Its reservation is already older than the eligibility threshold below
          // via the fixture's updated_at default.
          assert.equal(await claimNextStorageCleanupJob(10), null);
        });
        mock.method(storageService, 'remove', async () => { throw new Error('storage unavailable'); });
        await fixture.query("ALTER TABLE storage_cleanup_jobs ALTER COLUMN updated_at SET DEFAULT NOW() - INTERVAL '11 minutes'");
        const upload = (key: string) => uploadMediaObjects([{ path: key, buffer: Buffer.from('fixture'), contentType: 'image/webp' }], async connection => {
          if (failMetadata) throw new Error('metadata failure');
          return createMedia({ storagePath: key, diskName: key, fileName: 'fixture.webp', fileType: 'image', mimeType: 'image/webp', size: 7 }, connection);
        });
        await assert.rejects(upload(path), /metadata failure/);
        const pending = await claimNextStorageCleanupJob(10);
        assert.equal(pending?.storagePath, path);
        // Exclude this failed fixture from the next in-flight claim assertion.
        await fixture.query('UPDATE storage_cleanup_jobs SET completed_at=NOW() WHERE storage_path=$1', [path]);
        failMetadata = false;
        const committedPath = `media/${randomUUID()}/large.webp`;
        const created = await upload(committedPath);
        assert.equal((await fixture.query('SELECT * FROM storage_cleanup_jobs WHERE completed_at IS NULL')).rowCount, 0);
        let removed = false;
        assert.equal(await removeUnreferencedStorageObject(committedPath.replace('large.webp', 'thumbnail.webp'), async () => { removed = true; }), false);
        assert.equal(removed, false);
        await removeMedia(created.id);
        assert.equal((await fixture.query('SELECT * FROM storage_cleanup_jobs WHERE completed_at IS NULL')).rowCount, 3);
      });
    } finally {
      mock.restoreAll();
      await fixture.end();
      // Only the randomly generated fixture schema is removed; no application data is touched.
      await setup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      setup.release();
    }
  });
