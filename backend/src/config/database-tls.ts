import type { PoolConfig } from 'pg';

type ProductionDatabaseConfig = Pick<PoolConfig, 'connectionString'> & {
  ssl: { rejectUnauthorized: true; ca?: string };
};

// Shared by the server and operational scripts. pg parses connection-string
// options after PoolConfig, so a URL SSL option can replace the strict object.
export function productionDatabaseConfig(environment: NodeJS.ProcessEnv): ProductionDatabaseConfig {
  const connectionString = environment.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is required in production');
  }
  if (environment.DB_SSL_REJECT_UNAUTHORIZED === 'false') {
    throw new Error('Database TLS certificate verification is required in production');
  }

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // URL parsing errors can include the connection string and its credentials.
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }

  // A Unix socket bypasses pg's TLS handshake. Keep the URL authority as the
  // sole production host source; pg otherwise accepts a query-string override.
  let hostname: string;
  try {
    hostname = decodeURIComponent(url.hostname);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
  }
  if (hostname.startsWith('/')) {
    throw new Error('DATABASE_URL must use a TCP host for production TLS');
  }
  for (const name of url.searchParams.keys()) {
    if (name.toLowerCase().startsWith('ssl') || name.toLowerCase() === 'uselibpqcompat') {
      throw new Error('Configure database TLS with DB_SSL_CA; remove SSL parameters from DATABASE_URL');
    }
    if (name.toLowerCase() === 'host') {
      throw new Error('DATABASE_URL must not override the production host with a query parameter');
    }
  }

  return {
    connectionString,
    ssl: {
      rejectUnauthorized: true,
      ...(environment.DB_SSL_CA ? { ca: environment.DB_SSL_CA.replace(/\\n/g, '\n') } : {}),
    },
  };
}
