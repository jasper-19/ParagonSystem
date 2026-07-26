import { Request, Response, NextFunction } from "express";
import * as sessionRepository from "../modules/auth/session.repository";
import {
  AuthTokenPayload,
  getAuthToken,
  verifyAuthToken,
} from "../security/auth-token";

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

/**
 * Express middleware that verifies a Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 * Returns 401 if the header is missing, malformed, or the token is invalid/expired.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authToken = getAuthToken(req);

  if (!authToken) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const payload = verifyAuthToken(authToken.token);

    if (payload.sub !== "env-admin") {
      const active = await sessionRepository.validateAndTouchSession(
        payload.sub,
        payload.sid as string
      );

      if (!active) {
        res.status(401).json({ error: "Invalid or expired token" });
        return;
      }
    }

    req.user = payload;
    res.set({
      "Cache-Control": "no-store, private",
      Expires: "0",
      Pragma: "no-cache",
    });
    next();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("JWT_SECRET")
    ) {
      console.error("[authenticate] Authentication configuration error:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    res.status(401).json({ error: "Invalid or expired token" });
  }
}
