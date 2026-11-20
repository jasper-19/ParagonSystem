import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/asyncHandler';
import * as users from '../users/user.service';
import * as challenges from './login-challenge.repository';
import { findGoogleIdentity, linkGoogleIdentity } from './google-identity.repository';
import { finishGoogleOAuth, googleLoginDestination, startGoogleOAuth } from './google-oauth.service';
import { beginDbLogin, challengeUser, clearPendingLogin, deliverChallenge, loginError, pendingChallengeId, setPendingLogin } from './login-flow.service';
import { codeHash, maskEmail } from './email-code.service';
import { completeDbLogin } from './complete-login';
import { auditLog } from '../activity-logs/activity-log.audit';
import { developerEmail, enrollDeveloperIdentity } from './developer-account.repository';

export const googleStart = asyncHandler(async (req: Request, res: Response) => {
  const oauth = startGoogleOAuth();
  const pending = await challenges.createChallenge('oauth', oauth.data);
  await setPendingLogin(req, res, pending);
  res.json({ authorizationUrl: oauth.authorizationUrl });
});

export const googleCallback = asyncHandler(async (req: Request, res: Response) => {
  const destination = googleLoginDestination();
  try {
    const id = pendingChallengeId(req);
    const state = req.query.state;
    const code = req.query.code;
    if (!id || typeof state !== 'string' || state.length > 256 || typeof code !== 'string' || code.length > 4096) throw loginError();
    const pending = await challenges.consumeOAuth(id, state);
    if (!pending) throw loginError();
    const identity = await finishGoogleOAuth(code, pending.data);
    await enrollDeveloperIdentity(identity);
    const linked = await findGoogleIdentity(identity.subject);
    if (!linked) {
      const link = await challenges.createChallenge('google-link', identity);
      await setPendingLogin(req, res, link);
      res.redirect(303, `${destination}?google=link`);
      return;
    }
    const account = await users.getUserWithStaffById(linked.user_id);
    const email = account?.staff?.email.trim().toLowerCase() || await developerEmail(linked.user_id);
    if (!account?.user.isActive || linked.email !== identity.email || email !== identity.email) throw loginError();
    await beginDbLogin(req, res, account.user, destination);
  } catch {
    // OAuth errors may contain authorization codes or tokens; never log them.
    await clearPendingLogin(req, res);
    res.redirect(303, `${destination}?google=error`);
  }
});

export const googleLink = asyncHandler(async (req: Request, res: Response) => {
  const id = pendingChallengeId(req);
  const pending = id ? await challenges.attemptLink(id) : undefined;
  if (!pending) throw loginError();
  if (!await challenges.reserveCredentialAttempt(req.body.username, req.ip || 'unknown')) {
    throw loginError('Too many sign-in attempts. Please try again later.', 429);
  }
  const user = await users.authenticate(req.body.username, req.body.password);
  const account = user ? await users.getUserWithStaffById(user.id) : undefined;
  if (!user || !account?.user.isActive || account.staff?.email.trim().toLowerCase() !== pending.data.email) {
    throw loginError('Unable to link this account. Check your credentials and the Gmail address registered for your staff account.');
  }
  if (!await challenges.consumeLink(pending.id)) throw loginError();
  const linked = await linkGoogleIdentity({
    userId: user.id, subject: pending.data.subject!, email: pending.data.email!,
    passwordHash: user.passwordHash, authVersion: user.authVersion,
  });
  if (!linked) throw loginError('This Google account cannot be linked to your PARAGON account.', 409);
  await auditLog(req, 'LINK_GOOGLE', 'AUTH', 'Linked Google sign-in', { userId: user.id, resourceId: user.id });
  await beginDbLogin(req, res, user);
});

export const loginChallenge = asyncHandler(async (req: Request, res: Response) => {
  const id = pendingChallengeId(req);
  const pending = id ? await challenges.getChallenge(id) : undefined;
  if (!pending || pending.kind === 'oauth') throw loginError('No pending sign-in. Please sign in again.', 404);
  if (pending.kind === 'email') await challengeUser(pending);
  res.json({ kind: pending.kind, maskedEmail: maskEmail(pending.data.email!) });
});

export const verifyEmailCode = asyncHandler(async (req: Request, res: Response) => {
  const id = pendingChallengeId(req);
  if (!id) throw loginError();
  const current = await challenges.getChallenge(id);
  if (!current?.user_id || current.kind !== 'email') throw loginError();
  if (!await challenges.reserveAttempt(`email-code:${current.user_id}`, 10)) {
    throw loginError('Too many verification attempts. Please try again later.', 429);
  }
  const pending = await challenges.verifyCode(id, codeHash(id, req.body.code));
  if (!pending) throw loginError('The code is incorrect, expired, or has already been used. You have up to five attempts; otherwise, sign in again.');
  const user = await challengeUser(pending);
  await clearPendingLogin(req, res);
  await completeDbLogin(req, res, user);
});

export const resendEmailCode = asyncHandler(async (req: Request, res: Response) => {
  const id = pendingChallengeId(req);
  const pending = id ? await challenges.getChallenge(id) : undefined;
  if (!pending || pending.kind !== 'email') throw loginError();
  await deliverChallenge(pending);
  res.json({ maskedEmail: maskEmail(pending.data.email!) });
});

export const cancelLogin = asyncHandler(async (req: Request, res: Response) => {
  await clearPendingLogin(req, res);
  res.json({ ok: true });
});
