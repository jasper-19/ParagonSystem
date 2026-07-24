import { Pool, PoolConfig } from "pg";
import { performance } from "node:perf_hooks";
import dotenv from "dotenv";

dotenv.config();

const isProduction =
  process.env.NODE_ENV === "production";

const poolMax =
  Number(process.env.DB_POOL_MAX) ||
  (isProduction ? 5 : 10);

const configuredWarmCount =
  Number(process.env.DB_POOL_WARM_COUNT) ||
  (isProduction ? 1 : poolMax);

const poolWarmCount = Math.min(
  configuredWarmCount,
  poolMax
);

const poolConfig: PoolConfig = {
  max: poolMax,

  min: isProduction
    ? 0
    : poolWarmCount,

  idleTimeoutMillis: isProduction
    ? 30_000
    : 0,

  connectionTimeoutMillis: 5_000,
};

if (isProduction) {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required in production"
    );
  }

  poolConfig.connectionString =
    process.env.DATABASE_URL;

  poolConfig.ssl = {
    rejectUnauthorized: false,
  };
} else {
  poolConfig.user = process.env.DB_USER;
  poolConfig.host =
    process.env.DB_HOST || "127.0.0.1";
  poolConfig.database = process.env.DB_NAME;
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.port =
    Number(process.env.DB_PORT) || 5432;
}

console.log("[DB CONFIG]", {
  environment:
    process.env.NODE_ENV ?? "development",
  host: isProduction
    ? "production DATABASE_URL"
    : poolConfig.host,
  database: isProduction
    ? "production database"
    : poolConfig.database,
  port: poolConfig.port,
  maxConnections: poolMax,
  warmConnections: poolWarmCount,
});

const pool = new Pool(poolConfig);

let createdConnections = 0;

pool.on("connect", () => {
  createdConnections += 1;

  console.log(
    `[DB POOL] Connection ${createdConnections} created`,
    {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    }
  );
});

pool.on("error", err => {
  console.error(
    "Database pool error:",
    err
  );
});

export async function initializeDatabase(): Promise<void> {
  const startedAt = performance.now();

  const clients = await Promise.all(
    Array.from(
      { length: poolWarmCount },
      () => pool.connect()
    )
  );

  try {
    await Promise.all(
      clients.map(client =>
        client.query("SELECT 1")
      )
    );
  } finally {
    clients.forEach(client =>
      client.release()
    );
  }

  console.log(
    `[DB] Pool warmed with ${poolWarmCount} connections in ${(
      performance.now() - startedAt
    ).toFixed(2)}ms`
  );

  console.log("[DB POOL] Warm state", {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  });
}

export default pool;