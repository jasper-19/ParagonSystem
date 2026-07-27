import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { pdfConfig } from "../../config/pdf";
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

const diskStorage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: UploadedPdfFile,
    callback: (error: Error | null, destination: string) => void
  ) => {
    void mkdir(pdfConfig.tempRoot, { recursive: true })
      .then(() => callback(null, pdfConfig.tempRoot))
      .catch(error =>
        callback(
          error instanceof Error
            ? error
            : new Error("Temporary upload storage is unavailable"),
          pdfConfig.tempRoot
        )
      );
  },
  filename: (
    _req: Request,
    _file: UploadedPdfFile,
    callback: (error: Error | null, filename: string) => void
  ) => {
    callback(null, `${randomUUID()}.pdf`);
  },
});

const upload = multer({
  storage: diskStorage,
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
      file.mimetype.toLowerCase() !== "application/pdf"
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

export function parseSpecialIssuePdfUpload(
  req: PdfUploadRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.is("multipart/form-data")) {
    next();
    return;
  }

  upload(req, res, (error: unknown) => {
    if (error) {
      void removeUploadedTempFile(req).finally(() => next(error));
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
