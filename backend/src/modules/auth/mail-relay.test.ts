import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { signDelivery, verifyDelivery } from './mail-relay.service';
import { sendEmailCode, requireMailConfiguration } from './email-code.service';

const original = { ...process.env };
afterEach(() => { mock.restoreAll(); process.env = { ...original }; });
function configure() {
  process.env.AUTH_CHALLENGE_SECRET = 'fixture-challenge-secret-at-least-32-bytes';
  process.env.AUTH_MAIL_RELAY_SECRET = 'fixture-relay-secret-at-least-32-bytes';
  process.env.AUTH_MAIL_RELAY_URL = 'https://relay.fixture.test/api/auth-mail';
}
test('signed mail envelopes reject changed signatures and invalid recipient/code', () => {
  configure();
  assert.equal(verifyDelivery(signDelivery('fixture@gmail.com', '000001'))?.code, '000001');
  assert.equal(verifyDelivery(signDelivery('fixture@example.com', '000001')), undefined);
  assert.equal(verifyDelivery(signDelivery('fixture@gmail.com', '12345')), undefined);
  const envelope = signDelivery('fixture@gmail.com', '000001');
  assert.equal(verifyDelivery({ ...envelope, signature: '0'.repeat(64) }), undefined);
  process.env.AUTH_MAIL_RELAY_SECRET = process.env.AUTH_CHALLENGE_SECRET;
  assert.throws(requireMailConfiguration);
});
test('Render transport uses HTTPS without SMTP or browser credentials', async () => {
  configure();
  const expiresAt = Date.now() + 120_000;
  mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, process.env.AUTH_MAIL_RELAY_URL); assert.equal(options.redirect, 'error');
    assert.equal(verifyDelivery(JSON.parse(String(options.body)))?.expiresAt, expiresAt);
    assert.deepEqual(options.headers, { 'Content-Type': 'application/json' });
    return new Response(null, { status: 204 });
  });
  await sendEmailCode('fixture@gmail.com', '000001', expiresAt);
});
test('relay failures are sanitized and HTTPS configuration fails closed', async () => {
  configure();
  mock.method(globalThis, 'fetch', async () => { throw new Error('private provider details'); });
  await assert.rejects(sendEmailCode('fixture@gmail.com', '000001', Date.now() + 120_000), /Verification email could not be delivered/);
  process.env.AUTH_MAIL_RELAY_URL = 'http://unsafe.test';
  assert.throws(requireMailConfiguration);
});
