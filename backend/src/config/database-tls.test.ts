import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from 'pg';
import { productionDatabaseConfig } from './database-tls';

const databaseUrl = 'postgresql://synthetic:synthetic@db.example/synthetic';

test('production pg client retains strict TLS and the configured CA after URL parsing', () => {
  const client = new Client(productionDatabaseConfig({
    DATABASE_URL: `${databaseUrl}?application_name=synthetic-test`,
    DB_SSL_CA: 'synthetic-ca-line-1\\nsynthetic-ca-line-2',
  }));
  // Construct the installed pg Client, without opening a network connection.
  assert.equal(client.host, 'db.example');
  assert.deepEqual(client.ssl, {
    rejectUnauthorized: true,
    ca: 'synthetic-ca-line-1\nsynthetic-ca-line-2',
  });
});

test('production pool configuration rejects URL TLS controls before pg can override strict TLS', () => {
  for (const option of [
    'ssl=0', 'ssl=false', 'ssl=no-verify', 'ssl=true', 'ssl=1',
    'sslmode=disable', 'sslmode=no-verify', 'sslmode=verify-full',
    'sslcert=missing', 'sslkey=missing', 'sslrootcert=missing',
    'sslnegotiation=direct', 'uselibpqcompat=true', 'ssl=',
    's%73l=0', 'SSLMODE=disable', 'ssl=1&ssl=0',
  ]) {
    assert.throws(() => productionDatabaseConfig({ DATABASE_URL: `${databaseUrl}?${option}` }), /remove SSL parameters/);
  }
});

test('production TLS guard fails closed without leaking invalid URL input', () => {
  assert.throws(() => productionDatabaseConfig({}), /DATABASE_URL is required/);
  assert.throws(() => productionDatabaseConfig({ DATABASE_URL: databaseUrl, DB_SSL_REJECT_UNAUTHORIZED: 'false' }), /certificate verification/);
  for (const invalid of ['credential-bearing-invalid-url', 'https://db.example/test', 'postgresql:///test']) {
    assert.throws(() => productionDatabaseConfig({ DATABASE_URL: invalid }), error =>
      error instanceof Error && error.message === 'DATABASE_URL must be a valid PostgreSQL URL');
  }
  assert.deepEqual(new Client(productionDatabaseConfig({ DATABASE_URL: databaseUrl })).ssl, { rejectUnauthorized: true });
});

test('production TLS cannot be bypassed with a Unix socket or query host override', () => {
  for (const connectionString of [
    `${databaseUrl}?host=%2Fvar%2Frun%2Fpostgresql`,
    `${databaseUrl}?host=db.other.example`,
    `${databaseUrl}?h%6fst=%2Ftmp`,
    `${databaseUrl}?HOST=%2Ftmp`,
    'postgresql://synthetic:synthetic@%2Fvar%2Frun%2Fpostgresql/synthetic',
  ]) {
    assert.throws(() => productionDatabaseConfig({ DATABASE_URL: connectionString }), /production host|TCP host/);
  }
});
