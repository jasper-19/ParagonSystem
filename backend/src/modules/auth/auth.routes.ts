import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authenticate } from "../../middlewares/authenticate";
import { changePassword, login, logoutSession, me, listSessions, setTwoFaEnabled } from "./auth.controller";

// Strict rate limit on login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
});

const router = Router();

router.post("/login", loginLimiter, login);
router.get("/me", authenticate, me);
router.patch("/password", authenticate, changePassword);
router.patch("/2fa", authenticate, setTwoFaEnabled);
router.get("/sessions", authenticate, listSessions);
router.delete("/sessions/:id", authenticate, logoutSession);

export default router;
