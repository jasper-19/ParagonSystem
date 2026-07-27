import db from "../config/db";

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
       FROM paragon_internal.storage_cleanup_jobs
       WHERE completed_at IS NULL
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
