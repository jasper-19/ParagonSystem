import { Request, Response, NextFunction } from "express";
import xss from "xss";

/**
 * Recursively sanitize a value to strip XSS payloads.
 */
function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return xss(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        sanitizeValue(v),
      ])
    );
  }
  return value;
}

/**
 * Express middleware that sanitizes req.body against XSS.
 * req.query is read-only in Express 5, so query params are not mutated here;
 * controllers should use the sanitizeValue helper if they need clean query values.
 * Apply before routes so all user-supplied body data is clean.
 */
export function xssSanitize(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body) req.body = sanitizeValue(req.body);
  next();
}

/**
 * Exported for use in controllers that need to sanitize individual query params.
 */
export { sanitizeValue };
