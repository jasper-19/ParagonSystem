import { Request, Response, NextFunction } from "express";
import { PdfProcessingError } from "../modules/special-issues/pdf-processing/pdf.types";

export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  usage?: unknown;
  type?: string;
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

  // JSON parser errors can include submitted secrets from the raw request body.
  const invalidJson = err.type === "entity.parse.failed";
  const message = invalidJson ? "Invalid JSON request body" : err.message;
  console.error(
    `[ERROR] ${new Date().toISOString()} ${req.method} ${req.path} – ${statusCode}:`,
    message
  );
  if (!invalidJson && process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Send a sanitized response — stack traces never reach the client
  const pdfUnavailable = err instanceof PdfProcessingError && statusCode === 503 &&
    (err.code === "PDF_PROCESSOR_UNAVAILABLE" || err.code === "PDF_PROCESSOR_DISABLED");
  const response: Record<string, unknown> = {
    error:
      pdfUnavailable
        ? "PDF uploads are unavailable because the PDF processor is not configured. Please contact the administrator."
        : statusCode >= 500
        ? "Internal server error"
        : isMulterError
          ? multerCode === "LIMIT_FILE_SIZE"
            ? "Uploaded file is too large"
            : "Invalid file upload"
          : message,
  };
  if (pdfUnavailable) response["code"] = (err as PdfProcessingError).code;

  if (err.usage && statusCode < 500) {
    response["usage"] = err.usage;
  }

  res.status(statusCode).json(response);
  
}
