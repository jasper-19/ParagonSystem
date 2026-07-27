import "dotenv/config";
import db from "../config/db";
import { storageService } from "../storage/storage.factory";
import {
  claimNextStorageCleanupJob,
  completeStorageCleanupJob,
  failStorageCleanupJob,
} from "../storage/storage-cleanup.repository";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_MAX_ATTEMPTS = 10;

function positiveIntegerArgument(name: string, fallback: number): number {
  const prefix = `--${name}=`;
  const value = process.argv.find(argument => argument.startsWith(prefix));
  if (!value) return fallback;
  const parsed = Number(value.slice(prefix.length));
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${name} must be a positive integer`);
  }
  return parsed;
}

async function main(): Promise<void> {
  const batchSize = positiveIntegerArgument("batch-size", DEFAULT_BATCH_SIZE);
  const maxAttempts = positiveIntegerArgument(
    "max-attempts",
    DEFAULT_MAX_ATTEMPTS
  );
  let completed = 0;
  let failed = 0;

  for (let index = 0; index < batchSize; index += 1) {
    const job = await claimNextStorageCleanupJob(maxAttempts);
    if (!job) break;

    try {
      await storageService.remove([job.storagePath]);
      await completeStorageCleanupJob(job.id);
      completed += 1;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown storage error";
      await failStorageCleanupJob(job.id, message);
      failed += 1;
    }
  }

  console.info(
    JSON.stringify({
      event: "storage_cleanup_batch_completed",
      completed,
      failed,
      batchSize,
      maxAttempts,
    })
  );
}

main()
  .catch(error => {
    console.error(
      error instanceof Error ? error.message : "Storage cleanup failed"
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.end();
  });
