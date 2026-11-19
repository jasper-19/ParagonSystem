import { Router } from "express";
import { verifyDelivery } from './mail-relay.service';
import { reserveAttempt } from './login-challenge.repository';
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middlewares/authenticate";
import { requireTrustedBrowserRequest } from "../../middlewares/csrf";
import { validate, validateParams } from "../../middlewares/validate";
import { sessionIdParamSchema } from "../../schemas/common.schema";
import {
  changePassword,
  login,
  logout,
  logoutSession,
  me,
  listSessions,
  setTwoFaEnabled,
} from "./auth.controller";
import { changePasswordSchema, emailCodeSchema, loginSchema, twoFaPreferenceSchema } from "./auth.schema";
import { cancelLogin, googleCallback, googleLink, googleStart, loginChallenge, resendEmailCode, verifyEmailCode } from './federated-login.controller';

// Strict rate limit on login attempts per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: "Too many login attempts. Please try again later." },
});

const router = Router();
router.use((_req, res, next) => {
  res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', Expires: '0', 'Referrer-Policy': 'no-referrer' });
  next();
});
const challengeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many verification requests. Please try again later.' },
});
// Server-to-server only. A durable atomic claim prevents serverless request replay.
router.post('/mail-relay/claim', challengeLimiter, async (req, res, next) => {
  try {
    if (req.get('origin') || req.get('cookie')) { res.sendStatus(403); return; }
    const delivery = verifyDelivery(req.body);
    if (!delivery) { res.sendStatus(403); return; }
    if (!await reserveAttempt(`mail-relay:${delivery.nonce}`, 1)) { res.sendStatus(409); return; }
    res.sendStatus(204);
  } catch (error) { next(error); }
});
const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: req => req.user!.sub,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many password change attempts. Please try again later." },
});

router.post(
  "/login",
  loginLimiter,
  requireTrustedBrowserRequest,
  validate(loginSchema),
  login
);
router.post("/logout", authenticate, logout);
router.post('/google/start', challengeLimiter, requireTrustedBrowserRequest, googleStart);
router.get('/google/callback', challengeLimiter, googleCallback);
router.post('/google/link', loginLimiter, requireTrustedBrowserRequest, validate(loginSchema), googleLink);
router.get('/login/challenge', challengeLimiter, loginChallenge);
router.post('/login/cancel', challengeLimiter, requireTrustedBrowserRequest, cancelLogin);
router.post('/2fa/verify', challengeLimiter, requireTrustedBrowserRequest, validate(emailCodeSchema), verifyEmailCode);
router.post('/2fa/resend', challengeLimiter, requireTrustedBrowserRequest, resendEmailCode);
router.get("/me", authenticate, me);
router.patch("/password", authenticate, passwordLimiter, validate(changePasswordSchema), changePassword);
router.patch("/2fa", authenticate, validate(twoFaPreferenceSchema), setTwoFaEnabled);
router.get("/sessions", authenticate, listSessions);
router.delete(
  "/sessions/:id",
  authenticate,
  validateParams(sessionIdParamSchema),
  logoutSession
);

export default router;
