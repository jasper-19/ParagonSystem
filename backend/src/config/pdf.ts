import path from "node:path";
import os from "node:os";

export const PDF_COMPRESSION_PROFILES = [
  "screen",
  "ebook",
  "printer",
  "prepress",
  "default",
] as const;

export type PdfCompressionProfile =
  (typeof PDF_COMPRESSION_PROFILES)[number];

export type PdfCompressionFallback = "original" | "reject";

function boundedNumber(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function configuredProfile(): PdfCompressionProfile {
  const value = process.env.PDF_COMPRESSION_PROFILE?.trim().toLowerCase();
  return PDF_COMPRESSION_PROFILES.includes(value as PdfCompressionProfile)
    ? (value as PdfCompressionProfile)
    : "ebook";
}

function configuredFallback(): PdfCompressionFallback {
  return process.env.PDF_COMPRESSION_FALLBACK === "reject"
    ? "reject"
    : "original";
}

const maxUploadMb = boundedNumber(
  "SPECIAL_ISSUE_PDF_MAX_UPLOAD_MB",
  50,
  1,
  100
);

export const pdfConfig = Object.freeze({
  enabled: process.env.PDF_PROCESSOR_ENABLED !== "false",
  requiredForReadiness:
    process.env.PDF_PROCESSOR_REQUIRED === "true" ||
    process.env.NODE_ENV === "production",
  executable:
    process.env.PDF_GHOSTSCRIPT_PATH?.trim() ||
    (process.platform === "win32" ? "gswin64c" : "gs"),
  compressionProfile: configuredProfile(),
  compressionFallback: configuredFallback(),
  minSavingsPercent: boundedNumber(
    "PDF_COMPRESSION_MIN_SAVINGS_PERCENT",
    5,
    0,
    50
  ),
  maxUploadBytes: Math.floor(maxUploadMb * 1024 * 1024),
  maxUploadMb,
  maxPageCount: Math.floor(
    boundedNumber("PDF_MAX_PAGE_COUNT", 1000, 1, 10_000)
  ),
  processTimeoutMs: Math.floor(
    boundedNumber("PDF_PROCESS_TIMEOUT_MS", 45_000, 1_000, 120_000)
  ),
  processingConcurrency: Math.floor(
    boundedNumber("PDF_PROCESSING_CONCURRENCY", 1, 1, 4)
  ),
  uploadRateLimitPer15Minutes: Math.floor(
    boundedNumber("SPECIAL_ISSUE_UPLOAD_RATE_LIMIT", 10, 1, 100)
  ),
  maxProcessOutputBytes: 64 * 1024,
  tempRoot: path.join(os.tmpdir(), "paragon-special-issue-pdfs"),
});
