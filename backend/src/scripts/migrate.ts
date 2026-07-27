import { readFile } from "node:fs/promises";
import path from "node:path";
import type { QueryConfig } from "pg";
import pool from "../config/db";

function migrationTimeoutMs(): number {
  const configured = Number(process.env.DB_MIGRATION_TIMEOUT_MS);
  if (!Number.isFinite(configured)) return 120_000;
  return Math.min(Math.max(Math.floor(configured), 30_000), 600_000);
}

async function migrate(): Promise<void> {
  const migrationPath = path.resolve(process.cwd(), "src/config/migrate.sql");
  const sql = await readFile(migrationPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const timeoutMs = migrationTimeoutMs();
    await client.query(
      "SELECT set_config('statement_timeout', $1, true)",
      [String(timeoutMs)]
    );
    // `pg` supports query_timeout here at runtime, but the installed type
    // definition exposes it only on ClientConfig.
    const migrationQuery = {
      text: sql,
      query_timeout: timeoutMs,
    } as unknown as QueryConfig;
    await client.query(migrationQuery);
    await client.query("COMMIT");
    console.log("Database migration completed successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(error => {
  console.error("Database migration failed:", error);
  process.exitCode = 1;
});
