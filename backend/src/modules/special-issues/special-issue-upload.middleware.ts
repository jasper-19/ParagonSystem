import { unlink } from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { pdfConfig } from "../../config/pdf";
import { specialIssueUploadConfig } from "../../config/special-issue-upload";
import { createSpecialIssueDiskStorage } from "./special-issue-disk-storage";
import { sendReceiveTimeout } from "../../middlewares/request-receive-deadline";
import {
  createIssueSchema,
  createMultipartIssueSchema,
} from "./special-issue.schema";

export type UploadedPdfFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  destination: string;
  filename: string;
  path: string;
  size: number;
};

export type PdfUploadRequest = Request & {
  file?: UploadedPdfFile;
};

const upload = multer({
  storage: createSpecialIssueDiskStorage(pdfConfig.tempRoot),
  limits: {
    fileSize: pdfConfig.maxUploadBytes,
    files: 1,
    fields: 20,
    parts: 21,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024,
  },
  fileFilter: (
    _req: Request,
    file: UploadedPdfFile,
    callback: (error: Error | null, acceptFile?: boolean) => void
  ) => {
    if (
      file.fieldname !== "pdf" ||
      file.mimetype.toLowerCase() !== "application/pdf" ||
      !/\.pdf$/i.test(file.originalname)
    ) {
      callback(
        Object.assign(new Error("Only PDF uploads are accepted"), {
          statusCode: 415,
        })
      );
      return;
    }
    callback(null, true);
  },
}).single("pdf");

export function createUploadAdmission(limit: number) {
  let active = 0;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (active >= limit) {
      res.setHeader("Retry-After", "10");
      res.status(429).json({ error: "PDF uploads are busy. Please try again shortly." });
      return;
    }
    active++;
    let released = false;
    const release = (): void => {
      if (released) return;
      released = true;
      active--;
      res.removeListener("finish", release);
      res.removeListener("close", release);
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}

export const admitSpecialIssueUpload = createUploadAdmission(specialIssueUploadConfig.concurrency);

async function removeUploadedTempFile(req: PdfUploadRequest): Promise<void> {
  if (!req.file?.path) return;
  await unlink(req.file.path).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(
        JSON.stringify({
          event: "special_issue_pdf_temp_cleanup_failed",
          message:
            error instanceof Error
              ? error.message
              : "Unknown temporary file cleanup error",
        })
      );
    }
  });
}

export function createSpecialIssuePdfUploadParser(receiveTimeoutMs: number) {
return function parseSpecialIssuePdfUpload(
  req: PdfUploadRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.is("multipart/form-data")) {
    next();
    return;
  }

  const receiveTimeout = setTimeout(() => {
    sendReceiveTimeout(req, res, "PDF upload timed out. Please retry on a faster connection.");
  }, receiveTimeoutMs);
  receiveTimeout.unref();
  const clearReceiveTimeout = (): void => { clearTimeout(receiveTimeout); };
  res.once("close", clearReceiveTimeout);
  upload(req, res, (error: unknown) => {
    clearReceiveTimeout();
    res.removeListener("close", clearReceiveTimeout);
    if (error) {
      void removeUploadedTempFile(req).finally(() => {
        if (!req.aborted && !res.destroyed && !res.headersSent) next(error);
      });
      return;
    }

    let cleanupStarted = false;
    const cleanup = (): void => {
      if (cleanupStarted) return;
      cleanupStarted = true;
      void removeUploadedTempFile(req);
    };
    res.once("finish", cleanup);
    res.once("close", cleanup);
    next();
  });
}
}

export const parseSpecialIssuePdfUpload = createSpecialIssuePdfUploadParser(specialIssueUploadConfig.receiveTimeoutMs);

export function validateSpecialIssueCreateRequest(
  req: PdfUploadRequest,
  res: Response,
  next: NextFunction
): void {
  const isMultipart = Boolean(req.is("multipart/form-data"));
  if (isMultipart && !req.file) {
    res.status(400).json({ error: "A PDF file is required" });
    return;
  }

  const schema = isMultipart
    ? createMultipartIssueSchema
    : createIssueSchema;
  const result = schema.safeParse(req.body);

  if (!result.success) {
    res.status(400).json({
      error: "Validation failed",
      details: result.error.issues.map(issue => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  req.body = result.data;
  next();
}

export function requireSpecialIssuePdf(
  req: PdfUploadRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.file) {
    res.status(400).json({ error: "A PDF file is required" });
    return;
  }
  next();
}
