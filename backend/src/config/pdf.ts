import path from "node:path";
import os from "node:os";

export const PDF_COMPRESSION_PROFILES = [
  "high-quality",
  "balanced",
  "maximum",
  "screen",
  "ebook",
  "printer",
  "prepress",
  "default",
] as const;

export type PdfCompressionProfile =
  (typeof PDF_COMPRESSION_PROFILES)[number];

export type PdfCompressionFallback = "original" | "reject";

export function resolveBoundedPdfNumber(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const configured = value?.trim();
  if (!configured) return fallback;
  const parsed = Number(configured);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, minimum), maximum);
}

function boundedNumber(name: string, fallback: number, minimum: number, maximum: number): number {
  return resolveBoundedPdfNumber(process.env[name], fallback, minimum, maximum);
}

export function resolveCompressionProfile(value?: string): PdfCompressionProfile {
  const normalized = value?.trim().toLowerCase().replace(/[ _]+/g, "-");
  return PDF_COMPRESSION_PROFILES.includes(normalized as PdfCompressionProfile)
    ? (normalized as PdfCompressionProfile)
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
  // Configure an explicit binary path when Ghostscript is not on the host PATH.
  executable:
    process.env.PDF_GHOSTSCRIPT_PATH?.trim() ||
    (process.platform === "win32" ? "gswin64c" : "gs"),
  compressionProfile: resolveCompressionProfile(process.env.PDF_COMPRESSION_PROFILE),
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
  totalProcessTimeoutMs: Math.floor(
    boundedNumber("PDF_PROCESS_TOTAL_TIMEOUT_MS", 90_000, 1_000, 300_000)
  ),
  processingConcurrency: Math.floor(
    boundedNumber("PDF_PROCESSING_CONCURRENCY", 1, 1, 4)
  ),
  maxQueuedProcesses: Math.floor(
    boundedNumber("PDF_PROCESSING_MAX_QUEUE", 8, 0, 32)
  ),
  queueTimeoutMs: Math.floor(
    boundedNumber("PDF_PROCESSING_QUEUE_TIMEOUT_MS", 15_000, 100, 60_000)
  ),
  minCompressionInputBytes: Math.floor(
    boundedNumber("PDF_COMPRESSION_MIN_INPUT_KB", 256, 0, 10_240) * 1024
  ),
  minCompressionBytesPerPage: Math.floor(
    boundedNumber("PDF_COMPRESSION_MIN_KB_PER_PAGE", 64, 0, 1024) * 1024
  ),
  balancedImageDpi: Math.floor(
    boundedNumber("PDF_BALANCED_IMAGE_DPI", 150, 120, 300)
  ),
  maximumImageDpi: Math.floor(
    boundedNumber("PDF_MAXIMUM_IMAGE_DPI", 96, 72, 150)
  ),
  balancedJpegQFactor: boundedNumber("PDF_BALANCED_JPEG_QFACTOR", 0.4, 0.05, 1),
  maximumJpegQFactor: boundedNumber("PDF_MAXIMUM_JPEG_QFACTOR", 0.76, 0.05, 1),
  qpdfEnabled: process.env.PDF_QPDF_ENABLED === "true",
  qpdfExecutable: process.env.PDF_QPDF_PATH?.trim() || "qpdf",
  linearize: process.env.PDF_QPDF_LINEARIZE !== "false",
  uploadRateLimitPer15Minutes: Math.floor(
    boundedNumber("SPECIAL_ISSUE_UPLOAD_RATE_LIMIT", 10, 1, 100)
  ),
  maxProcessOutputBytes: 64 * 1024,
  tempRoot: path.join(os.tmpdir(), "paragon-special-issue-pdfs"),
});
