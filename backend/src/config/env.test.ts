import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { validateEnvironment } from './env';

const original = { ...process.env };
afterEach(() => { process.env = { ...original }; });
function production() {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'synthetic-production-secret-at-least-32-bytes';
  process.env.DATABASE_URL = 'postgresql://test:test@db.example/test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-service-key';
  process.env.SUPABASE_URL = 'https://storage.example';
  delete process.env.DB_SSL_REJECT_UNAUTHORIZED;
  process.env.API_BASE_URL = 'https://api.example';
  delete process.env.ALLOW_ENV_ADMIN;
}
test('production requires database certificate verification', () => {
  production();
  assert.doesNotThrow(validateEnvironment);
  process.env.DB_SSL_REJECT_UNAUTHORIZED = 'false';
  assert.throws(validateEnvironment, /certificate verification/);
});
test('production rejects connection-string TLS overrides', () => {
  production();
  for (const setting of ['ssl=0', 'ssl=no-verify', 'sslmode=no-verify', 'sslmode=disable', 'sslcert=anything', 'sslrootcert=anything', 'sslkey=anything', 'sslnegotiation=direct', 'uselibpqcompat=true']) {
    process.env.DATABASE_URL = `postgresql://test:test@db.example/test?${setting}`;
    assert.throws(validateEnvironment, /remove SSL parameters/);
  }
});
