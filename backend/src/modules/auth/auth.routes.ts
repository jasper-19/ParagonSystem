import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login } from "./auth.controller";

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

export default router;
