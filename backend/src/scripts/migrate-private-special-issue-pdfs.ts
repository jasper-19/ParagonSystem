import 'dotenv/config';
import db from '../config/db';
import { storageBucket, supabase } from '../config/storage';
import { SupabasePrivatePdfStorage, readSupabasePdf } from '../storage/private-pdf-storage';
import { assertPrivatePdfAccessPolicy } from '../storage/private-pdf-policy';
import { migratePrivatePdf, verifyPdfStream, MigrationPdf } from '../storage/private-pdf-migration';
import { isPrivatePdfKey } from '../storage/private-pdf-path';
import { withStorageCancellation } from '../storage/storage-fetch';

async function main() {
  const apply = process.argv.includes('--apply');
  const purge = process.argv.includes('--purge-public-originals');
  const limit = Number(process.argv.find(value => value.startsWith('--limit='))?.slice(8) || '25');
  const after = process.argv.find(value => value.startsWith('--after='))?.slice(8) || null;
  if (after && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(after)) throw new Error('Invalid batch cursor');
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) throw new Error('Invalid batch size');
  if (purge && !apply) throw new Error('Public purge requires --apply and explicit approval');
  if (apply && !process.argv.includes('--maintenance-window-confirmed')) {
    throw new Error('Pause mutations and drain cleanup workers, then confirm the maintenance window');
  }
  if (purge) {
    const remaining = await db.query(`SELECT 1 FROM special_issues WHERE pdf_storage_path IS NULL
      OR pdf_storage_path NOT LIKE 'private-special-issues/%' LIMIT 1`);
    if (remaining.rows.length) throw new Error('Complete every legacy/manual PDF migration before public purge');
  }
  const rows = await db.query(
    `SELECT id, pdf_storage_path, pdf_url, pdf_optimized_size_bytes, pdf_sha256 FROM special_issues
     WHERE pdf_storage_path LIKE $1 AND ($3::uuid IS NULL OR id > $3::uuid) ORDER BY id LIMIT $2`,
    [purge ? 'private-special-issues/%' : 'special-issues/%', limit, after]
  );
  if (!apply) {
    const legacy = await db.query(`SELECT COUNT(*)::int AS count FROM special_issues
      WHERE pdf_storage_path IS NULL OR
        (pdf_storage_path NOT LIKE 'special-issues/%' AND pdf_storage_path NOT LIKE 'private-special-issues/%')`);
    console.info(JSON.stringify({ apply: false, candidates: rows.rowCount, manualReview: legacy.rows[0].count }));
    return;
  }
  const store = new SupabasePrivatePdfStorage();
  await store.assertPrivate();
  await assertPrivatePdfAccessPolicy(db);
  let migrated = 0; let conflicted = 0; let purged = 0; let failed = 0;
  for (const row of rows.rows) {
    const record: MigrationPdf = { id: String(row.id), storagePath: String(row.pdf_storage_path),
      pdfUrl: String(row.pdf_url), size: Number(row.pdf_optimized_size_bytes), sha256: String(row.pdf_sha256) };
    try {
      if (purge) {
        if (!isPrivatePdfKey(record.storagePath) || !Number.isSafeInteger(record.size) || record.size <= 0 ||
          record.size > 100 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('Invalid migration metadata');
        const signal = AbortSignal.timeout(60_000);
        const digest = await verifyPdfStream(await store.read(record.storagePath,
          { start: 0, end: record.size - 1 }, record.size, signal), record.size, signal);
        if (digest !== record.sha256) throw new Error('Private PDF verification failed');
        const legacyKey = record.storagePath.replace(/^private-/, '');
        const legacyUrl = supabase.storage.from(storageBucket).getPublicUrl(legacyKey).data.publicUrl;
        const client = await db.connect();
        try {
          await client.query('BEGIN');
          // Prevent concurrent table writes between the last reference check and deletion.
          await client.query("SET LOCAL lock_timeout = '5s'");
          await client.query("SET LOCAL idle_in_transaction_session_timeout = '120s'");
          await client.query('LOCK TABLE special_issues, media_files, paragon_internal.storage_cleanup_jobs IN SHARE ROW EXCLUSIVE MODE');
          const references = await client.query(`SELECT 1 FROM special_issues WHERE pdf_storage_path = $1 OR pdf_url = $2
            UNION ALL SELECT 1 FROM media_files WHERE storage_path = $1
            UNION ALL SELECT 1 FROM paragon_internal.storage_cleanup_jobs WHERE storage_path = $1 AND completed_at IS NULL LIMIT 1`,
          [legacyKey, legacyUrl]);
          const unchanged = await client.query(`SELECT 1 FROM special_issues WHERE id=$1 AND pdf_storage_path=$2 AND pdf_sha256=$3`,
            [record.id, record.storagePath, digest]);
          if (references.rows.length || !unchanged.rows.length) { conflicted++; await client.query('ROLLBACK'); continue; }
          const removed = await withStorageCancellation(AbortSignal.timeout(60_000), async () =>
            supabase.storage.from(storageBucket).remove([legacyKey]));
          if (removed.error) throw new Error('Public original deletion failed');
          await client.query('COMMIT'); purged++;
        } catch (error) { await client.query('ROLLBACK'); throw error; }
        finally { client.release(); }
      } else {
        const committed = await migratePrivatePdf(record, {
          readSource: (key, size, signal) => readSupabasePdf(storageBucket, key, { start: 0, end: size - 1 }, size, signal),
          readPrivate: (key, size, signal) => store.read(key, { start: 0, end: size - 1 }, size, signal),
          upload: (key, file, signal) => store.uploadFile(key, file, { contentType: 'application/pdf', upsert: false, signal }),
          swap: async (expected, key, url) => {
            const changed = await db.query(`WITH updated AS (
              UPDATE special_issues SET pdf_storage_path=$1, pdf_url=$2, updated_at=NOW()
              WHERE id=$3 AND pdf_storage_path=$4 AND pdf_url=$5 AND pdf_sha256=$6 AND pdf_optimized_size_bytes=$7 RETURNING id
            ), retained_original AS (
              UPDATE paragon_internal.storage_cleanup_jobs SET completed_at=NOW(), last_error=NULL,
                reason='private-migration-original-retained', updated_at=NOW()
              WHERE storage_path=$4 AND completed_at IS NULL AND EXISTS (SELECT 1 FROM updated) RETURNING id
            ) SELECT id FROM updated`,
              [key, url, expected.id, expected.storagePath, expected.pdfUrl, expected.sha256, expected.size]);
            return Boolean(changed.rowCount);
          },
        });
        if (committed) migrated++; else conflicted++;
      }
    } catch { failed++; } // Do not log storage URLs, signed URLs, tokens or source data.
  }
  console.info(JSON.stringify({ apply: true, migrated, conflicted, purged, failed,
    nextAfter: rows.rows.at(-1)?.id ?? null }));
  if (failed || conflicted) process.exitCode = 1;
}
main().catch(() => { console.error('Private PDF migration failed; inspect configuration and retry in staging.'); process.exitCode = 1; })
  .finally(() => db.end());
