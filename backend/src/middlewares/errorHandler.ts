import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
}

/**
 * Centralized error handling middleware.
 * Must be the last middleware registered in app.ts.
 * Never exposes internal stack traces to the client.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? err.status ?? 500;

  // Log full error details server-side only
  console.error(
    `[ERROR] ${new Date().toISOString()} ${req.method} ${req.path} – ${statusCode}:`,
    err.message
  );
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Send a sanitized response — stack traces never reach the client
  res.status(statusCode).json({
    error: statusCode === 500 ? "Internal server error" : err.message,
  });
}
