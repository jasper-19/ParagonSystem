import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

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
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
