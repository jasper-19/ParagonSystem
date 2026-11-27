import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { JSDOM } from 'jsdom';
import nodemailer from 'nodemailer';
import { createAuthMailHandler, verifyDelivery } from './auth-mail.mjs';

const secret = 'fixture-relay-secret-that-is-at-least-32-bytes';
const env = { AUTH_MAIL_RELAY_SECRET: secret, AUTH_GMAIL_USER: 'fixture@gmail.com',
  AUTH_GMAIL_APP_PASSWORD: 'fixture-password', AUTH_MAIL_CLAIM_URL: 'https://api.fixture.test/api/auth/mail-relay/claim',
  PUBLIC_SITE_URL: 'https://site.fixture.test' };
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
    { issuedAt: Date.now() + 10000 }, { issuedAt: '123' }, { expiresAt: 'soon' },
    { expiresAt: 8_640_000_000_000_001 }]) assert.equal(verifyDelivery(sign(bad), secret), undefined);
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
        assert.equal(mail.from.address, env.AUTH_GMAIL_USER); assert.match(mail.text, /000001/);
        assert.match(mail.text, /expires? in 5 minutes/i); }, close: () => { closed++; } };
    },
  });
  const body = sign(); const results = await Promise.all([handler(req(body)), handler(req(body))]);
  assert.deepEqual(results.map(r => r.status).sort(), [204, 409]);
  assert.equal(sends, 1); assert.equal(closed, 1);
});

test('relay composes branded HTML and plain text into a multipart delivery', async () => {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + 120_000;
  const code = '012345';
  const signed = sign({ code, issuedAt, expiresAt });
  let mail;
  let mime;
  const handler = createAuthMailHandler({
    env,
    request: async (_url, options) => {
      assert.deepEqual(JSON.parse(options.body), signed);
      assert.equal(verifyDelivery(signed, secret).expiresAt, expiresAt);
      return new Response(null, { status: 204 });
    },
    createTransport: () => {
      const stream = nodemailer.createTransport({ streamTransport: true, buffer: true });
      return {
        sendMail: async message => {
          mail = message;
          mime = (await stream.sendMail(message)).message.toString('utf8');
        },
        close: () => stream.close(),
      };
    },
  });

  const response = await handler(req(signed));
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await response.text(), '');
  assert.equal(mail.subject, 'Your PARAGON sign-in code');
  assert.ok(/^Content-Type: multipart\/alternative;/im.test(mime), 'message uses multipart/alternative');
  assert.ok(/^Content-Type: text\/plain;/im.test(mime), 'message includes the plain-text part');
  assert.ok(/^Content-Type: text\/html;/im.test(mime), 'message includes the HTML part');

  const { window } = new JSDOM(mail.html);
  try {
    const { document } = window;
    assert.equal(document.documentElement.lang, 'en');
    assert.equal(document.querySelector('h1').textContent.trim(), 'Verify your sign-in.');
    assert.ok(document.querySelector('table[role="presentation"][style*="max-width:600px"], table[role="presentation"][style*="max-width: 600px"]'));
    const logo = document.querySelector('img');
    assert.equal(logo.src, env.PUBLIC_SITE_URL + '/apple-touch-icon.png');
    assert.equal(logo.getAttribute('alt'), '');
    const brand = logo.closest('tr');
    assert.equal(brand.querySelector('strong').textContent, 'PARAGON');
    assert.match(brand.textContent, /The Official Student Publication/);
    const preview = document.querySelector('.preheader');
    assert.ok(preview.textContent.trim());
    assert.ok(!preview.textContent.includes(code));
    const digits = Array.from(document.querySelectorAll('.otp-digit'));
    assert.deepEqual(digits.map(digit => digit.textContent), [...code]);
    const codeRange = document.createRange();
    codeRange.setStartBefore(digits[0]);
    codeRange.setEndAfter(digits.at(-1));
    assert.equal(codeRange.toString(), code);
    assert.ok(digits.every(digit => digit.closest('td') === digits[0].closest('td')));
    assert.match(mail.html, /prefers-color-scheme:\s*dark/i);
    assert.match(mail.html, /<!--\[if mso\]>/i);
    const links = Array.from(document.querySelectorAll('a'), link => new URL(link.href).href);
    assert.ok(links.includes(env.PUBLIC_SITE_URL + '/'));
    assert.ok(links.includes(env.PUBLIC_SITE_URL + '/privacy-policy'));
    const expiryTime = new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit',
    }).formatToParts(expiresAt);
    const hour = expiryTime.find(part => part.type === 'hour').value;
    const minute = expiryTime.find(part => part.type === 'minute').value;
    for (const part of [document.body.textContent, mail.text]) {
      assert.match(part, /never share|do not share/i);
      assert.match(part, /if you (did not|didn.t)/i);
      assert.match(part, /expires [^.]*Philippine time/i);
      assert.ok(part.includes(hour + ':' + minute), 'expiry uses the signed deadline in Philippine time');
    }
    assert.ok(mail.text.includes(code));
    assert.ok(links.every(link => !link.includes(code)));
  } finally {
    window.close();
  }
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
