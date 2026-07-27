import "dotenv/config";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Client, type ClientConfig } from "pg";

function testDatabaseConfig(): ClientConfig {
  const connectionString = process.env.MIGRATION_TEST_DATABASE_URL?.trim();
  if (connectionString) {
    return {
      connectionString,
      ssl:
        process.env.MIGRATION_TEST_DB_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    };
  }

  const database = process.env.MIGRATION_TEST_DB_NAME?.trim();
  if (!database) {
    throw new Error(
      "Set MIGRATION_TEST_DB_NAME or MIGRATION_TEST_DATABASE_URL to a disposable database"
    );
  }
  assertDisposableDatabaseName(database);
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
  };
}

function assertDisposableDatabaseName(databaseName: string): void {
  if (!/(?:^|[_-])(?:test|ci|tmp)(?:$|[_-])/i.test(databaseName)) {
    throw new Error(
      `Refusing migration verification against non-test database "${databaseName}"`
    );
  }
}

async function main(): Promise<void> {
  const client = new Client(testDatabaseConfig());
  await client.connect();

  try {
    const identity = await client.query<{ database_name: string }>(
      "SELECT current_database() AS database_name"
    );
    const databaseName = identity.rows[0]?.database_name ?? "";
    assertDisposableDatabaseName(databaseName);

    const migrationPath = path.resolve(
      process.cwd(),
      "src/config/migrate.sql"
    );
    const migrationSql = await readFile(migrationPath, "utf8");
    await client.query("BEGIN");
    await client.query("SET LOCAL statement_timeout = '120s'");
    await client.query(migrationSql);

    const verification = await client.query<{
      metadata_columns: string;
      cleanup_table: string | null;
      pending_index: string | null;
      metadata_constraint: string | null;
      rls_enabled: boolean;
    }>(
      `SELECT
         (
           SELECT COUNT(*)::text
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'special_issues'
             AND column_name IN (
               'pdf_storage_path',
               'pdf_original_filename',
               'pdf_original_size_bytes',
               'pdf_optimized_size_bytes',
               'pdf_compression_percent',
               'pdf_page_count',
               'pdf_sha256',
               'pdf_compression_profile',
               'pdf_processor'
             )
         ) AS metadata_columns,
         to_regclass(
           'paragon_internal.storage_cleanup_jobs'
         )::text AS cleanup_table,
         to_regclass(
           'paragon_internal.idx_storage_cleanup_jobs_pending_path'
         )::text AS pending_index,
         (
           SELECT conname
           FROM pg_constraint
           WHERE conrelid = 'public.special_issues'::regclass
             AND conname = 'special_issues_pdf_metadata_complete'
         ) AS metadata_constraint,
         (
           SELECT relrowsecurity
           FROM pg_class
           WHERE oid = 'public.special_issues'::regclass
         ) AS rls_enabled`
    );
    const result = verification.rows[0]!;

    assert.equal(Number(result.metadata_columns), 9);
    assert.ok(result.cleanup_table);
    assert.ok(result.pending_index);
    assert.ok(result.metadata_constraint);
    assert.equal(result.rls_enabled, true);

    await client.query("ROLLBACK");
    console.info(
      JSON.stringify({
        event: "special_issue_migration_verified",
        database: databaseName,
        rolledBack: true,
      })
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch(error => {
  console.error(
    error instanceof Error ? error.message : "Migration verification failed"
  );
  process.exitCode = 1;
});
