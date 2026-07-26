import { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  usage?: unknown;
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
  const isMulterError = err.name === "MulterError";
  const multerCode = (err as AppError & { code?: string }).code;
  const requestedStatusCode = isMulterError
    ? multerCode === "LIMIT_FILE_SIZE"
      ? 413
      : 400
    : err.statusCode ?? err.status ?? 500;
  const statusCode =
    Number.isInteger(requestedStatusCode) &&
    requestedStatusCode >= 400 &&
    requestedStatusCode <= 599
      ? requestedStatusCode
      : 500;

  // Log full error details server-side only
  console.error(
    `[ERROR] ${new Date().toISOString()} ${req.method} ${req.path} – ${statusCode}:`,
    err.message
  );
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Send a sanitized response — stack traces never reach the client
  const response: Record<string, unknown> = {
    error:
      statusCode >= 500
        ? "Internal server error"
        : isMulterError
          ? multerCode === "LIMIT_FILE_SIZE"
            ? "Uploaded file is too large"
            : "Invalid file upload"
          : err.message,
  };

  if (err.usage && statusCode < 500) {
    response["usage"] = err.usage;
  }

  res.status(statusCode).json(response);
  
}
