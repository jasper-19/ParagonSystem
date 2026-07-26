import { NextFunction, Request, Response } from "express";
import { isAllowedOrigin } from "../config/security";
import { getAuthToken } from "../security/auth-token";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_HEADER = "x-csrf-protection";
const CSRF_HEADER_VALUE = "1";

function isTrustedBrowserRequest(req: Request): boolean {
  return (
    req.get(CSRF_HEADER) === CSRF_HEADER_VALUE &&
    isAllowedOrigin(req.get("origin"))
  );
}

export function requireTrustedBrowserRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!isTrustedBrowserRequest(req)) {
    res.status(403).json({ error: "Untrusted request origin" });
    return;
  }

  next();
}

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const authToken = getAuthToken(req);
  if (!authToken || authToken.source !== "cookie") {
    next();
    return;
  }

  requireTrustedBrowserRequest(req, res, next);
}
