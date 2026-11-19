import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { createAuthMailHandler, verifyDelivery } from './auth-mail.mjs';

const secret = 'fixture-relay-secret-that-is-at-least-32-bytes';
const env = { AUTH_MAIL_RELAY_SECRET: secret, AUTH_GMAIL_USER: 'fixture@gmail.com',
  AUTH_GMAIL_APP_PASSWORD: 'fixture-password', AUTH_MAIL_CLAIM_URL: 'https://api.fixture.test/api/auth/mail-relay/claim' };
const sign = (overrides = {}) => {
  const payload = Buffer.from(JSON.stringify({ email: 'recipient@gmail.com', code: '000001',
    nonce: 'a'.repeat(64), issuedAt: Date.now(), ...overrides })).toString('base64url');
  return { payload, signature: createHmac('sha256', secret).update('paragon-mail-relay-v1\n' + payload).digest('hex') };
};
const req = (body = sign(), headers = {}) => new Request('https://site.fixture.test/api/auth-mail', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body),
});

test('relay verifies exact signed bytes, Gmail address, code, nonce and bounded timestamp', () => {
  assert.equal(verifyDelivery(sign(), secret).code, '000001');
  assert.equal(verifyDelivery(sign(), 'other-secret-at-least-thirty-two-bytes'), undefined);
  assert.equal(verifyDelivery({ ...sign(), signature: 'x'.repeat(64) }, secret), undefined);
  for (const bad of [{ email: 'a@gmail.com\r\nBcc: b@gmail.com' }, { email: 'a@example.com' },
    { code: '12345' }, { code: 123456 }, { nonce: 'short' }, { issuedAt: Date.now() - 61000 },
    { issuedAt: Date.now() + 10000 }, { issuedAt: '123' }]) assert.equal(verifyDelivery(sign(bad), secret), undefined);
  const signed = sign();
  assert.equal(verifyDelivery({ ...signed, payload: signed.payload.slice(0, -1) + 'A' }, secret), undefined);
});

test('relay sends only after a durable claim; concurrent replay sends once', async () => {
  let claimed = false; let sends = 0; let closed = 0;
  const handler = createAuthMailHandler({ env,
    request: async (url, options) => {
      assert.equal(url, env.AUTH_MAIL_CLAIM_URL); assert.equal(options.redirect, 'error');
      assert.ok(verifyDelivery(JSON.parse(options.body), secret));
      if (claimed) return new Response(null, { status: 409 });
      claimed = true; return new Response(null, { status: 204 });
    },
    createTransport: options => {
      assert.equal(options.host, 'smtp.gmail.com'); assert.equal(options.secure, true);
      return { sendMail: async mail => { sends++; assert.equal(mail.to, 'recipient@gmail.com');
        assert.equal(mail.from.address, env.AUTH_GMAIL_USER); assert.match(mail.text, /000001/); }, close: () => { closed++; } };
    },
  });
  const body = sign(); const results = await Promise.all([handler(req(body)), handler(req(body))]);
  assert.deepEqual(results.map(r => r.status).sort(), [204, 409]);
  assert.equal(sends, 1); assert.equal(closed, 1);
});

test('relay rejects browser requests, oversized and malformed envelopes without contacting a provider', async () => {
  const handler = createAuthMailHandler({ env, request: () => { throw new Error('must not contact claim'); },
    createTransport: () => { throw new Error('must not send'); } });
  assert.equal((await handler(req(sign(), { Origin: 'https://site.fixture.test' }))).status, 403);
  assert.equal((await handler(req(sign(), { Cookie: 'session=fixture' }))).status, 403);
  assert.equal((await handler(req({ payload: 'a'.repeat(3000) }))).status, 413);
  assert.equal((await handler(req({}))).status, 403);
  assert.equal((await handler(new Request('https://site.fixture.test/api/auth-mail'))).status, 405);
});

test('relay fails closed on claim failures, SMTP errors, and invalid configuration', async () => {
  let sends = 0; let closed = false;
  const transport = () => ({ sendMail: async () => { sends++; throw new Error('private provider details'); }, close: () => { closed = true; } });
  const denied = createAuthMailHandler({ env, request: async () => new Response(null, { status: 503 }), createTransport: transport });
  assert.equal((await denied(req())).status, 503); assert.equal(sends, 0);
  const failed = createAuthMailHandler({ env, request: async () => new Response(null, { status: 204 }), createTransport: transport });
  const response = await failed(req());
  assert.equal(response.status, 503); assert.equal(await response.text(), ''); assert.equal(closed, true);
  const invalid = createAuthMailHandler({ env: { ...env, AUTH_MAIL_CLAIM_URL: 'http://unsafe.test/' }, createTransport: transport });
  assert.equal((await invalid(req())).status, 503);
});
