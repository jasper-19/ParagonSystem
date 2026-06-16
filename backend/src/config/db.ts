import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const poolConfig: PoolConfig = {};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;

  if (process.env.NODE_ENV === "production") {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} else {
  poolConfig.user = process.env.DB_USER;
  poolConfig.host = process.env.DB_HOST || "localhost";
  poolConfig.database = process.env.DB_NAME;
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.port = Number(process.env.DB_PORT) || 5432;
}

const pool = new Pool(poolConfig);

pool.on("connect", () => console.log("Connected to the database"));
pool.on("error", (err) => console.error("Database error:", err));

export default pool;