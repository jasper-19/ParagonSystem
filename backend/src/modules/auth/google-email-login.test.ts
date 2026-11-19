import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { generateKeyPairSync } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { codeHash, generateEmailCode, maskEmail, requireMailConfiguration } from './email-code.service';
import { finishGoogleOAuth, startGoogleOAuth, verifiedGoogleIdentity } from './google-oauth.service';
import { emailCodeSchema } from './auth.schema';

const original = { ...process.env };
afterEach(() => { mock.restoreAll(); process.env = { ...original }; });
function config(): void {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_CHALLENGE_SECRET = 'fixture-challenge-secret-at-least-32-bytes';
  process.env.GOOGLE_CLIENT_ID = 'fixture-google-client';
  process.env.GOOGLE_CLIENT_SECRET = 'fixture-google-secret';
  process.env.GOOGLE_CALLBACK_URL = 'http://localhost:3000/api/auth/google/callback';
  process.env.FRONTEND_URL = 'http://localhost:4200';
}

test('codes preserve leading zeroes, have six digits, and hashes bind to each challenge', () => {
  config();
  for (let i = 0; i < 100; i++) assert.match(generateEmailCode(), /^\d{6}$/);
  assert.notEqual(codeHash('challenge-a', '000001'), codeHash('challenge-b', '000001'));
  assert.notEqual(codeHash('challenge-a', '000001'), codeHash('challenge-a', '000002'));
  assert.equal(maskEmail('fixture@gmail.com'), 'f***@gmail.com');
  for (const code of ['12345', '1234567', '12 345', 'abcdef', 123456]) assert.equal(emailCodeSchema.safeParse({ code }).success, false);
  assert.equal(emailCodeSchema.safeParse({ code: '000001' }).success, true);
});

test('missing email transport or weak challenge secrets fail closed', () => {
  config(); delete process.env.AUTH_SMTP_HOST;
  assert.throws(() => requireMailConfiguration());
  process.env.AUTH_CHALLENGE_SECRET = 'short';
  assert.throws(() => codeHash('fixture', '123456'));
});

test('OAuth authorization uses state, nonce, PKCE, and a fixed redirect without exposing the client secret', () => {
  config(); const flow = startGoogleOAuth(); const url = new URL(flow.authorizationUrl);
  assert.equal(url.origin, 'https://accounts.google.com');
  assert.equal(url.searchParams.get('state'), flow.data.state);
  assert.equal(url.searchParams.get('nonce'), flow.data.nonce);
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('redirect_uri'), process.env.GOOGLE_CALLBACK_URL);
  assert.equal(flow.authorizationUrl.includes(process.env.GOOGLE_CLIENT_SECRET!), false);
  assert.equal(flow.authorizationUrl.includes(flow.data.verifier!), false);
});

test('only verified Gmail identities with the expected nonce are accepted', () => {
  const payload = { sub: 'fixture-sub', email: 'Fixture@gmail.com', email_verified: true, nonce: 'fixture-nonce' };
  assert.deepEqual(verifiedGoogleIdentity(payload, 'fixture-nonce'), { subject: 'fixture-sub', email: 'fixture@gmail.com' });
  for (const bad of [{ ...payload, email_verified: false }, { ...payload, email: 'fixture@example.com' },
    { ...payload, nonce: 'other-nonce' }, { ...payload, sub: '' }]) {
    assert.throws(() => verifiedGoogleIdentity(bad, 'fixture-nonce'));
  }
});

test('the Google library verifies signature, issuer, audience, and expiry before identity claims', async () => {
  config();
  const key = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const publicPem = key.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  let token = '';
  mock.method(OAuth2Client.prototype, 'getToken', async () => ({ tokens: { id_token: token } }));
  mock.method(OAuth2Client.prototype, 'getFederatedSignonCertsAsync', async () => ({ certs: { fixture: publicPem }, format: 'PEM' }));
  const mint = (claims: Record<string, unknown> = {}) => jwt.sign({
    sub: 'fixture-sub', email: 'fixture@gmail.com', email_verified: true, nonce: 'fixture-nonce',
    iss: 'https://accounts.google.com', aud: 'fixture-google-client', ...claims,
  }, key.privateKey, { algorithm: 'RS256', keyid: 'fixture', expiresIn: 300 });
  token = mint();
  assert.equal((await finishGoogleOAuth('fixture-code', { verifier: 'fixture-verifier', nonce: 'fixture-nonce' })).subject, 'fixture-sub');
  for (const claims of [{ aud: 'attacker-client' }, { iss: 'https://attacker.example' }, { nonce: 'wrong-nonce' }]) {
    token = mint(claims);
    await assert.rejects(() => finishGoogleOAuth('fixture-code', { verifier: 'fixture-verifier', nonce: 'fixture-nonce' }));
  }
  token = jwt.sign({ sub: 'fixture-sub', email: 'fixture@gmail.com', email_verified: true, nonce: 'fixture-nonce' },
    key.privateKey, { algorithm: 'RS256', keyid: 'fixture', issuer: 'https://accounts.google.com', audience: 'fixture-google-client', expiresIn: -3600 });
  await assert.rejects(() => finishGoogleOAuth('fixture-code', { verifier: 'fixture-verifier', nonce: 'fixture-nonce' }));
  // Change a decoded signature byte: the final base64url character can contain
  // unused padding bits, so editing that character need not alter the signature.
  const parts = mint().split('.');
  const signature = Buffer.from(parts[2]!, 'base64url');
  signature[0] = signature[0]! ^ 1;
  parts[2] = signature.toString('base64url');
  token = parts.join('.');
  await assert.rejects(() => finishGoogleOAuth('fixture-code', { verifier: 'fixture-verifier', nonce: 'fixture-nonce' }));
});
