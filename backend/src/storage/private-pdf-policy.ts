import type { Pool } from 'pg';

export function pdfBucketName(): string {
  const bucket = process.env.SUPABASE_PDF_STORAGE_BUCKET || 'paragon-pdfs';
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket) || bucket === (process.env.SUPABASE_STORAGE_BUCKET || 'paragon-media')) {
    throw new Error('PDF storage must use a separate private bucket');
  }
  return bucket;
}

export function privatePdfDenialPolicySql(bucket = pdfBucketName()): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket)) throw new Error('Invalid PDF bucket');
  return `CREATE POLICY paragon_private_pdfs_browser_denied ON storage.objects AS RESTRICTIVE
    FOR ALL TO anon, authenticated USING (bucket_id <> '${bucket}') WITH CHECK (bucket_id <> '${bucket}')`;
}

export async function assertPrivatePdfAccessPolicy(db: Pick<Pool, 'query'>, bucket = pdfBucketName()): Promise<void> {
  const expression = `(bucket_id <> '${bucket}'::text)`;
  const result = await db.query(
    `SELECT 1 FROM pg_policies p JOIN pg_class c ON c.relname = p.tablename
     JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = p.schemaname
     WHERE p.schemaname = 'storage' AND p.tablename = 'objects'
       AND c.relrowsecurity = TRUE AND p.permissive = 'RESTRICTIVE' AND p.cmd = 'ALL'
       AND p.roles @> ARRAY['anon','authenticated']::name[]
       AND p.qual = $1 AND p.with_check = $1 LIMIT 1`, [expression]
  );
  if (!result.rows.length) throw new Error('Private PDF bucket browser-denial policy is missing');
}
