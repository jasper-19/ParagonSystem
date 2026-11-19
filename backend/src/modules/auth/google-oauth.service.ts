import { createHash, randomBytes } from 'node:crypto';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { isAllowedOrigin } from '../../config/security';

function configuredUrl(name: string): URL {
  const value = process.env[name];
  if (!value) throw Object.assign(new Error('Google sign-in is not configured'), { statusCode: 503 });
  const url = new URL(value);
  const local = process.env.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw Object.assign(new Error('Invalid Google sign-in URL configuration'), { statusCode: 503 });
  }
  return url;
}

export function googleLoginDestination(): string {
  const url = configuredUrl('FRONTEND_URL');
  if (!isAllowedOrigin(url.origin)) throw new Error('Invalid frontend origin');
  return new URL('/admin/login', url.origin).href;
}

function client(): OAuth2Client {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!id || !secret) throw Object.assign(new Error('Google sign-in is not configured'), { statusCode: 503 });
  const callback = configuredUrl('GOOGLE_CALLBACK_URL');
  if (callback.pathname !== '/api/auth/google/callback') {
    throw Object.assign(new Error('Invalid Google callback path'), { statusCode: 503 });
  }
  googleLoginDestination();
  return new OAuth2Client({ clientId: id, clientSecret: secret, redirectUri: callback.href });
}

export function startGoogleOAuth(): { authorizationUrl: string; data: Record<string, string> } {
  const state = randomBytes(32).toString('base64url');
  const nonce = randomBytes(32).toString('base64url');
  const verifier = randomBytes(48).toString('base64url');
  const codeChallenge = createHash('sha256').update(verifier).digest('base64url');
  const authorizationUrl = client().generateAuthUrl({
    scope: ['openid', 'email'], state, nonce, prompt: 'select_account',
    code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256,
  });
  return { authorizationUrl, data: { state, nonce, verifier } };
}

export function verifiedGoogleIdentity(payload: {
  sub?: string; email?: string; email_verified?: boolean; nonce?: unknown;
}, nonce: string): { subject: string; email: string } {
  // Gmail ownership is authoritative at Google. Other email providers are not
  // accepted for this Gmail-specific enrollment and delivery flow.
  if (!payload.sub || payload.sub.length > 255 || payload.email_verified !== true ||
      payload.nonce !== nonce || !payload.email || !/^[^\s@]+@gmail\.com$/i.test(payload.email)) {
    throw new Error('A verified Gmail account is required');
  }
  return { subject: payload.sub, email: payload.email.toLowerCase() };
}

export async function finishGoogleOAuth(code: string, data: Record<string, string>): Promise<{ subject: string; email: string }> {
  const oauth = client();
  const { tokens } = await oauth.getToken({ code, codeVerifier: data.verifier! });
  if (!tokens.id_token) throw new Error('Google did not return an identity token');
  const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: process.env.GOOGLE_CLIENT_ID! });
  const payload = ticket.getPayload();
  if (!payload) throw new Error('Missing Google identity');
  return verifiedGoogleIdentity(payload, data.nonce!);
}
