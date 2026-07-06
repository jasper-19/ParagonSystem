import { Pool, PoolConfig } from "pg";
import dotenv from "dotenv";

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";

const poolConfig: PoolConfig = {};

if (isProduction) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required in production");
  }

  poolConfig.connectionString = process.env.DATABASE_URL;
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  poolConfig.user = process.env.DB_USER;
  poolConfig.host = process.env.DB_HOST || "localhost";
  poolConfig.database = process.env.DB_NAME;
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.port = Number(process.env.DB_PORT) || 5432;
}

const pool = new Pool(poolConfig);

pool.on("connect", () => {
  console.log(
    isProduction
      ? "Connected to production database"
      : `Connected to local database: ${process.env.DB_NAME}`
  );
});

pool.on("error", (err) => console.error("Database error:", err));

export default pool;