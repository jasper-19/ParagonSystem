import { readFile } from "node:fs/promises";
import path from "node:path";
import pool from "../config/db";

async function migrate(): Promise<void> {
  const migrationPath = path.resolve(process.cwd(), "src/config/migrate.sql");
  const sql = await readFile(migrationPath, "utf8");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(sql);
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

