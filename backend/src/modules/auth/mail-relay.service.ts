import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIX = 'paragon-mail-relay-v1\n';
export function requireRelaySecret(): string {
  const secret = process.env.AUTH_MAIL_RELAY_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32 || secret === process.env.AUTH_CHALLENGE_SECRET) {
    throw Object.assign(new Error('Email relay is not configured'), { statusCode: 503 });
  }
  return secret;
}
export function relayUrl(): string {
  const url = new URL(process.env.AUTH_MAIL_RELAY_URL || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Email relay requires a fixed HTTPS URL');
  }
  return url.href;
}
export function signDelivery(email: string, code: string): { payload: string; signature: string } {
  const payload = Buffer.from(JSON.stringify({ email, code, nonce: randomBytes(32).toString('hex'),
    issuedAt: Date.now() })).toString('base64url');
  return { payload, signature: createHmac('sha256', requireRelaySecret()).update(PREFIX + payload).digest('hex') };
}
export function verifyDelivery(body: unknown): { email: string; code: string; nonce: string; issuedAt: number } | undefined {
  if (!body || typeof body !== 'object') return;
  const { payload, signature } = body as Record<string, unknown>;
  if (typeof payload !== 'string' || payload.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(payload)
    || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)) return;
  const expected = createHmac('sha256', requireRelaySecret()).update(PREFIX + payload).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, 'hex'))) return;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof data.email !== 'string' || data.email.length > 254 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/.test(data.email)
      || typeof data.code !== 'string' || !/^\d{6}$/.test(data.code)
      || typeof data.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(data.nonce)
      || !Number.isSafeInteger(data.issuedAt) || data.issuedAt > Date.now() + 5000 || Date.now() - data.issuedAt > 60_000) return;
    return data;
  } catch { return; }
}
