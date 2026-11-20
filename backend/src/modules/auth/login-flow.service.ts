import { Request, Response } from 'express';
import { AuthTokenPayload, clearAuthCookie, credentialFingerprint, getCookieSameSite, readCookie } from '../../security/auth-token';
import { User } from '../users/user.types';
import { developerEmail } from './developer-account.repository';
import * as userService from '../users/user.service';
import * as challenges from './login-challenge.repository';
import { getGoogleIdentity } from './google-identity.repository';
import { completeDbLogin } from './complete-login';
import { codeHash, generateEmailCode, maskEmail, requireMailConfiguration, sendEmailCode } from './email-code.service';

const cookieName = () => process.env.NODE_ENV === 'production' ? '__Host-paragon_login' : 'paragon_login';
const cookieOptions = () => ({ httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', sameSite: getCookieSameSite() });

export function pendingChallengeId(req: Request): string | undefined {
  const token = readCookie(req.headers.cookie, cookieName());
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? challenges.challengeId(token) : undefined;
}

export async function clearPendingLogin(req: Request, res: Response): Promise<void> {
  const id = pendingChallengeId(req);
  if (id) await challenges.cancelChallenge(id);
  res.clearCookie(cookieName(), cookieOptions());
}

export async function setPendingLogin(req: Request, res: Response, pending: { token: string }): Promise<void> {
  await clearPendingLogin(req, res);
  clearAuthCookie(res);
  res.cookie(cookieName(), pending.token, { ...cookieOptions(), maxAge: 10 * 60 * 1000 });
}

export function loginError(message = 'Verification expired or invalid. Please sign in again.', statusCode = 401): Error {
  return Object.assign(new Error(message), { statusCode });
}

export async function linkedGmail(userId: string): Promise<{ subject: string; email: string }> {
  const [identity, account] = await Promise.all([getGoogleIdentity(userId), userService.getUserWithStaffById(userId)]);
  const email = account?.staff?.email.trim().toLowerCase() || await developerEmail(userId);
  if (!identity || !account?.user.isActive ||
      email !== identity.email || !/^[^\s@]+@gmail\.com$/.test(identity.email)) {
    throw loginError('Sign in with Google and link your staff Gmail account before using email verification.', 409);
  }
  return identity;
}

export async function challengeUser(challenge: challenges.LoginChallenge): Promise<User> {
  if (!challenge.user_id) throw loginError();
  const user = await userService.getUserById(challenge.user_id);
  if (!user?.isActive || user.authVersion !== challenge.data.authVersion ||
      credentialFingerprint(user.passwordHash) !== challenge.data.credentials || !user.twoFaEnabled) throw loginError();
  const identity = await linkedGmail(user.id);
  if (identity.subject !== challenge.data.subject || identity.email !== challenge.data.email) throw loginError();
  return user;
}

export async function deliverChallenge(challenge: challenges.LoginChallenge): Promise<void> {
  await challengeUser(challenge);
  requireMailConfiguration();
  if (!await challenges.reserveDelivery(challenge.user_id!)) {
    throw loginError('Please wait at least a minute before requesting another code. A maximum of five emails can be sent in 15 minutes.', 429);
  }
  const code = generateEmailCode();
  if (!await challenges.setEmailCode(challenge.id, codeHash(challenge.id, code))) throw loginError();
  try {
    await sendEmailCode(challenge.data.email!, code);
  } catch (error) {
    await challenges.cancelChallenge(challenge.id);
    throw error;
  }
}

export async function beginDbLogin(req: Request, res: Response, user: User, redirectBase?: string): Promise<'success' | 'verify'> {
  if (!user.twoFaEnabled) {
    await clearPendingLogin(req, res);
    await completeDbLogin(req, res, user, redirectBase ? `${redirectBase}?google=success` : undefined);
    return 'success';
  }
  requireMailConfiguration();
  const identity = await linkedGmail(user.id);
  const pending = await challenges.createChallenge('email', {
    authVersion: user.authVersion, credentials: credentialFingerprint(user.passwordHash),
    email: identity.email, subject: identity.subject,
  }, user.id);
  const challenge = await challenges.getChallenge(pending.id);
  if (!challenge) throw loginError();
  try {
    await deliverChallenge(challenge);
  } catch (error) {
    await challenges.cancelChallenge(pending.id);
    throw error;
  }
  await setPendingLogin(req, res, pending);
  if (redirectBase) res.redirect(303, `${redirectBase}?google=verify`);
  else res.json({ twoFactorRequired: true, maskedEmail: maskEmail(identity.email) });
  return 'verify';
}

export async function requireTwoFaChange(userId: string, payload: AuthTokenPayload | undefined, enabled: boolean): Promise<void> {
  if (!enabled && await developerEmail(userId)) {
    throw loginError('Email verification is required for developer accounts.', 403);
  }
  if (!payload?.iat || Date.now() / 1000 - payload.iat > 300) {
    throw loginError('Please sign in again before changing two-factor authentication.', 403);
  }
  if (enabled) {
    requireMailConfiguration();
    await linkedGmail(userId);
  }
}
