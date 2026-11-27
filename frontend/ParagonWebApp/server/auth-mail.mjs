import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import { renderSignInEmail } from './email/transactional.cjs';

// This module is server-only. Never import it from Angular src/.
export function verifyDelivery(body, secret, now = Date.now()) {
  if (!secret || Buffer.byteLength(secret) < 32 || !body || typeof body !== 'object') return;
  const { payload, signature } = body;
  if (typeof payload !== 'string' || payload.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(payload)
    || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return;
  const expected = createHmac('sha256', secret).update('paragon-mail-relay-v1\n' + payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.email !== 'string' || data.email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/.test(data.email)
      || typeof data.code !== 'string' || !/^\d{6}$/.test(data.code)
      || typeof data.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(data.nonce)
      || (data.expiresAt !== undefined && (!Number.isSafeInteger(data.expiresAt) || data.expiresAt <= 0
        || data.expiresAt > 8_640_000_000_000_000))
      || !Number.isSafeInteger(data.issuedAt) || data.issuedAt > now + 5000 || now - data.issuedAt > 60_000) return;
    return data;
  } catch { return; }
}

export function createAuthMailHandler({ env = process.env, request = fetch, createTransport = nodemailer.createTransport } = {}) {
  return async function POST(req) {
    const reply = status => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
    if (req.method !== 'POST') return reply(405);
    if (req.headers.has('origin') || req.headers.has('cookie')) return reply(403);
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('content-type') || '')) return reply(415);
    let transport;
    try {
      // Bound streamed bodies too; Content-Length alone is not sufficient.
      const reader = req.body?.getReader();
      if (!reader) return reply(400);
      const chunks = []; let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 2048) { await reader.cancel(); return reply(413); }
          chunks.push(Buffer.from(value));
        }
      } finally { reader.releaseLock(); }
      let body;
      try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return reply(400); }
      const delivery = verifyDelivery(body, env.AUTH_MAIL_RELAY_SECRET);
      if (!delivery) return reply(403);
      const sender = env.AUTH_GMAIL_USER;
      if (!sender || !/^[a-z0-9.]+@gmail\.com$/i.test(sender) || !env.AUTH_GMAIL_APP_PASSWORD) return reply(503);
      const claimUrl = new URL(env.AUTH_MAIL_CLAIM_URL);
      if (claimUrl.protocol !== 'https:' || claimUrl.username || claimUrl.password || claimUrl.search || claimUrl.hash
        || claimUrl.pathname !== '/api/auth/mail-relay/claim') return reply(503);
      const claim = await request(claimUrl.href, { method: 'POST', redirect: 'error',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000) });
      await claim.body?.cancel();
      if (claim.status !== 204) return reply(claim.status === 409 ? 409 : 503);
      transport = createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, requireTLS: true,
        auth: { user: sender, pass: env.AUTH_GMAIL_APP_PASSWORD }, connectionTimeout: 8000, greetingTimeout: 8000,
        socketTimeout: 12_000, disableFileAccess: true, disableUrlAccess: true });
      await transport.sendMail({ from: { name: 'PARAGON', address: sender }, to: delivery.email,
        ...renderSignInEmail({ code: delivery.code, expiresAt: delivery.expiresAt, appUrl: env.PUBLIC_SITE_URL }) });
      return reply(204);
    } catch {
      // Provider errors can expose credentials and message contents. Never log them.
      return reply(503);
    } finally { transport?.close(); }
  };
}
