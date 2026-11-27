import { createHmac, randomInt } from 'node:crypto';
import nodemailer from 'nodemailer';
import { renderSignInEmail } from '../../email/transactional.cjs';
import { relayUrl, requireRelaySecret, signDelivery } from './mail-relay.service';

export function requireChallengeSecret(): string {
  const secret = process.env.AUTH_CHALLENGE_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw Object.assign(new Error('Email verification is not configured'), { statusCode: 503 });
  }
  return secret;
}

export function codeHash(id: string, code: string): string {
  return createHmac('sha256', requireChallengeSecret()).update(`paragon-email-code\0${id}\0${code}`).digest('hex');
}

export function generateEmailCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name?.slice(0, 1) ?? ''}***@${domain ?? ''}`;
}

export function requireMailConfiguration(): void {
  requireChallengeSecret();
  if (process.env.AUTH_MAIL_RELAY_URL) {
    requireRelaySecret();
    relayUrl();
    return;
  }
  for (const name of ['AUTH_SMTP_HOST', 'AUTH_SMTP_USER', 'AUTH_SMTP_PASSWORD', 'AUTH_EMAIL_FROM']) {
    if (!process.env[name]?.trim()) {
      throw Object.assign(new Error('Email verification is not configured'), { statusCode: 503 });
    }
  }
  const port = Number(process.env.AUTH_SMTP_PORT || 465);
  if (port !== 465 && port !== 587) throw Object.assign(new Error('Email transport requires TLS'), { statusCode: 503 });
}

export async function sendEmailCode(email: string, code: string, expiresAt: number): Promise<void> {
  requireMailConfiguration();
  if (process.env.AUTH_MAIL_RELAY_URL) {
    try {
      const response = await fetch(relayUrl(), {
        method: 'POST', redirect: 'error', signal: AbortSignal.timeout(65_000),
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(signDelivery(email, code, expiresAt)),
      });
      if (!response.ok) throw new Error('Relay delivery failed');
      await response.body?.cancel();
      return;
    } catch {
      throw Object.assign(new Error('Verification email could not be delivered. Please try again later.'), { statusCode: 503 });
    }
  }
  const port = Number(process.env.AUTH_SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.AUTH_SMTP_HOST!, port, secure: port === 465, requireTLS: true,
    auth: { user: process.env.AUTH_SMTP_USER!, pass: process.env.AUTH_SMTP_PASSWORD! },
    connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    disableFileAccess: true, disableUrlAccess: true,
  });
  try {
    await transport.sendMail({
      from: process.env.AUTH_EMAIL_FROM!, to: email,
      ...renderSignInEmail({ code, expiresAt, appUrl: process.env.FRONTEND_URL }),
    });
  } catch {
    // SMTP errors can contain credentials, recipients, and message content.
    throw Object.assign(new Error('Verification email could not be delivered. Please try again later.'), { statusCode: 503 });
  } finally {
    transport.close();
  }
}
