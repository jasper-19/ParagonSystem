import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import * as sessionRepository from "../modules/auth/session.repository";

/**
 * Express middleware that verifies a Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 * Returns 401 if the header is missing, malformed, or the token is invalid/expired.
 */
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers["authorization"];

  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    console.error("[authenticate] JWT_SECRET is not set");
    res.status(500).json({ error: "Internal server error" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);
    // Attach to request for downstream use if needed
    (req as any).user = payload;

    const p: any = payload as any;
    const subject = p?.sub as string | undefined;
    const sessionId = p?.sid as string | undefined;

    // Best-effort session tracking for DB-backed users. Tokens issued before session
    // tracking existed may not have `sid`, so we don't hard-require it.
    if (subject && subject !== "env-admin" && sessionId) {
      sessionRepository
        .isSessionActive(sessionId)
        .then((active) => {
          if (!active) {
            res.status(401).json({ error: "Invalid or expired token" });
            return;
          }

          // Update last_active_at asynchronously (do not block the request)
          sessionRepository.touchSession(sessionId).catch(() => undefined);
          next();
        })
        .catch(() => {
          res.status(500).json({ error: "Internal server error" });
        });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
