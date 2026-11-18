import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { privatePdfDenialPolicySql, assertPrivatePdfAccessPolicy } from '../storage/private-pdf-policy';
import { assertAuthVersionSchema } from '../security/auth-version';
const { PGlite } = require(process.env.SECURITY_PGLITE_MODULE || '@electric-sql/pglite');

async function main() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE paragon_backend;
    CREATE SCHEMA storage; CREATE TABLE storage.objects(id int, bucket_id text);
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated;
    GRANT ALL ON storage.objects TO anon, authenticated;
    CREATE POLICY permissive_fixture ON storage.objects FOR ALL TO PUBLIC USING(true) WITH CHECK(true);
    INSERT INTO storage.objects VALUES (1,'paragon-pdfs'),(2,'paragon-media');
    CREATE TABLE public.users(id int, username text DEFAULT 'fixture', password_hash text DEFAULT 'hash',
      role text DEFAULT 'admin', staff_id uuid, is_active boolean DEFAULT true,
      last_login_at timestamptz, two_fa_enabled boolean DEFAULT false);
    CREATE TABLE public.applications(id int);
    CREATE TABLE public.special_issues(id int);
    INSERT INTO public.users VALUES(1);
    ALTER TABLE public.users OWNER TO paragon_backend;
    GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC, anon, authenticated;`);
  await assert.rejects(assertPrivatePdfAccessPolicy(db));
  await db.exec(privatePdfDenialPolicySql('paragon-pdfs'));
  await assertPrivatePdfAccessPolicy(db);
  for (const role of ['anon','authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    const result = await db.query('SELECT bucket_id FROM storage.objects');
    assert.deepEqual(result.rows, [{ bucket_id: 'paragon-media' }]);
    await assert.rejects(db.exec("INSERT INTO storage.objects VALUES(3,'paragon-pdfs')"));
    await db.exec('RESET ROLE');
  }
  const sql = await readFile('src/config/migrate.security.sql','utf8');
  await assert.rejects(assertAuthVersionSchema(db));
  await db.exec('BEGIN'); await db.exec(sql); await db.exec('COMMIT');
  await assertAuthVersionSchema(db);
  await db.exec('BEGIN'); await db.exec(sql); await db.exec('COMMIT');
  const grants = await db.query(`SELECT relname,relrowsecurity,
    has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS anon_access,
    has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS auth_access
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'`);
  assert.equal(grants.rows.length,3);
  for (const row of grants.rows) { assert.equal(row.relrowsecurity,true); assert.equal(row.anon_access,false); assert.equal(row.auth_access,false); }
  await db.exec('SET ROLE paragon_backend');
  assert.equal((await db.query('SELECT * FROM public.users')).rows.length,1);
  const version = async () => (await db.query('SELECT auth_version::text AS v FROM public.users WHERE id=1')).rows[0].v;
  let expected = 0n;
  assert.equal(await version(), String(expected));
  // Restoring original fields must never restore the authenticated epoch.
  for (const [change, restore] of [
    ['is_active=false','is_active=true'],
    ["role='staff'", "role='admin'"],
    ["password_hash='new-hash'", "password_hash='hash'"],
    ["staff_id='11111111-1111-4111-8111-111111111111'", 'staff_id=null'],
    ["username='changed'", "username='fixture'"],
  ]) {
    await db.exec(`UPDATE public.users SET ${change}, auth_version=0 WHERE id=1`);
    assert.equal(await version(), String(++expected));
    await db.exec(`UPDATE public.users SET ${restore}, auth_version=0 WHERE id=1`);
    assert.equal(await version(), String(++expected));
  }
  await db.exec(`UPDATE public.users SET last_login_at=NOW(), two_fa_enabled=true,
    password_hash=password_hash, role=role, auth_version=0 WHERE id=1`);
  assert.equal(await version(), String(expected));
  await db.exec('RESET ROLE');
  await db.exec('BEGIN'); await db.exec(sql); await db.exec('COMMIT');
  assert.equal(await version(), String(expected));
  await db.exec('ALTER TABLE public.users DISABLE TRIGGER users_advance_auth_version');
  await assert.rejects(assertAuthVersionSchema(db));
  await db.exec('ALTER TABLE public.users ENABLE TRIGGER users_advance_auth_version');
  await assertAuthVersionSchema(db);
  await db.close();
  console.log('PostgreSQL validation passed: private bucket policy; browser grants; backend-owner updates; monotonic authentication versions across restored credentials/permissions; metadata/no-op preservation; migration idempotence; disabled-trigger startup denial.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
