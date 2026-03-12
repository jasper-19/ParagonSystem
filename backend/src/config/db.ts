import { Pool } from "pg";
import dotenv from "dotenv";

// Load env vars early — db.ts may be imported before dotenv.config() runs in server.ts
dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT) || 5432,
});

pool.on("connect", () => {
    console.log("Connected to the database");
});

pool.on("error", (err) => {
    console.error("Database error:", err);
});

export default pool;