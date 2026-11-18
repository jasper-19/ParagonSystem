import db from "../config/db";
import { withStorageCancellation } from './storage-fetch';

// Recheck immediately before deletion while application reference writers are
// excluded. Claim-time checks alone cannot protect a later storage operation.
export async function removeUnreferencedStorageObject(storagePath: string, remove: () => Promise<void>): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    // Storage transport is bounded to 60s; retain locks beyond that deadline.
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '120s'");
    await client.query('LOCK TABLE special_issues, media_files IN SHARE ROW EXCLUSIVE MODE');
    const references = await client.query(`SELECT 1 FROM special_issues WHERE pdf_storage_path=$1
      UNION ALL SELECT 1 FROM media_files WHERE storage_path=$1 LIMIT 1`, [storagePath]);
    if (references.rows.length) { await client.query('COMMIT'); return false; }
    await withStorageCancellation(AbortSignal.timeout(60_000), remove);
    await client.query('COMMIT');
    return true;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export type StorageCleanupJob = {
  id: string;
  storagePath: string;
  reason: string;
  attempts: number;
};

export async function claimNextStorageCleanupJob(
  maxAttempts: number
): Promise<StorageCleanupJob | null> {
  const result = await db.query(
    `WITH candidate AS (
       SELECT id
       FROM paragon_internal.storage_cleanup_jobs AS queued
       WHERE completed_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM special_issues s WHERE s.pdf_storage_path = queued.storage_path)
         AND NOT EXISTS (SELECT 1 FROM media_files m WHERE m.storage_path = queued.storage_path)
         AND attempts < $1
         AND (
           attempts = 0
           OR updated_at < NOW() - INTERVAL '10 minutes'
         )
       ORDER BY created_at, id
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE paragon_internal.storage_cleanup_jobs AS job
     SET attempts = job.attempts + 1,
         updated_at = NOW()
     FROM candidate
     WHERE job.id = candidate.id
     RETURNING job.id, job.storage_path, job.reason, job.attempts`,
    [maxAttempts]
  );

  const row = result.rows[0];
  return row
    ? {
        id: String(row.id),
        storagePath: String(row.storage_path),
        reason: String(row.reason),
        attempts: Number(row.attempts),
      }
    : null;
}

export async function completeStorageCleanupJob(id: string): Promise<void> {
  await db.query(
    `UPDATE paragon_internal.storage_cleanup_jobs
     SET completed_at = NOW(),
         last_error = NULL,
         updated_at = NOW()
     WHERE id = $1
       AND completed_at IS NULL`,
    [id]
  );
}

export async function failStorageCleanupJob(
  id: string,
  errorMessage: string
): Promise<void> {
  await db.query(
    `UPDATE paragon_internal.storage_cleanup_jobs
     SET last_error = $2,
         updated_at = NOW()
     WHERE id = $1
       AND completed_at IS NULL`,
    [id, errorMessage.slice(0, 500)]
  );
}
