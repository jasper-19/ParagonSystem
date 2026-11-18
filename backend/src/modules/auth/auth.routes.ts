import { Router } from "express";
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
import { changePasswordSchema, loginSchema, twoFaPreferenceSchema } from "./auth.schema";

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
