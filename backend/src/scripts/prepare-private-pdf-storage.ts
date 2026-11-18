import 'dotenv/config';
import db from '../config/db';
import { supabase } from '../config/storage';
import { assertPrivatePdfAccessPolicy, pdfBucketName, privatePdfDenialPolicySql } from '../storage/private-pdf-policy';
import { pdfConfig } from '../config/pdf';

async function main() {
  const apply = process.argv.includes('--apply');
  const bucket = pdfBucketName();
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (!apply) {
    let policyReady = false;
    try { await assertPrivatePdfAccessPolicy(db, bucket); policyReady = true; } catch {}
    console.info(JSON.stringify({ apply: false, bucketExists: !error && Boolean(data),
      bucketPrivate: !error && data?.public === false, policyReady }));
    return;
  }
  if (!data) {
    // Refuse to proceed after permission/network failures; only a confirmed 404
    // may create a bucket. Never change an existing bucket's visibility.
    if (!error || ![(error as any).status, (error as any).statusCode].some(value => String(value) === '404')) throw new Error('Could not verify the PDF bucket');
    const created = await supabase.storage.createBucket(bucket, {
      public: false, fileSizeLimit: pdfConfig.maxUploadBytes, allowedMimeTypes: ['application/pdf'],
    });
    if (created.error) throw new Error('Private PDF bucket creation failed');
  } else if (data.public !== false) throw new Error('The configured PDF bucket is public; use a new private bucket');
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const state = await client.query(`SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='storage' AND c.relname='objects'`);
    if (state.rows[0]?.relrowsecurity !== true) throw new Error('Storage objects must already have RLS enabled');
    const previous = await client.query(`SELECT qual FROM pg_policies WHERE schemaname='storage'
      AND tablename='objects' AND policyname='paragon_private_pdfs_browser_denied'`);
    if (previous.rows.length && previous.rows[0].qual !== `(bucket_id <> '${bucket}'::text)`) {
      throw new Error('Existing PDF policy protects a different bucket; manual review is required');
    }
    await client.query('DROP POLICY IF EXISTS paragon_private_pdfs_browser_denied ON storage.objects');
    // Bucket is restricted to ASCII letters/digits/_/- before this literal.
    await client.query(privatePdfDenialPolicySql(bucket));
    await assertPrivatePdfAccessPolicy(client as any, bucket);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
  console.info(JSON.stringify({ apply: true, bucketPrivate: true, policyReady: true }));
}
main().catch(() => { console.error('Private PDF storage preparation failed; no credentials were logged.'); process.exitCode = 1; })
  .finally(() => db.end());
