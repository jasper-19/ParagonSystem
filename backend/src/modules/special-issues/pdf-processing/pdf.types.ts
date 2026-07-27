export type PdfProcessingStatus =
  | "optimized"
  | "no-benefit"
  | "compression-fallback";

export type ProcessedPdf = {
  filePath: string;
  temporaryOutputPath?: string;
  originalFilename: string;
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  compressionPercent: number;
  pageCount: number;
  sha256: string;
  processor: string;
  profile: string;
  status: PdfProcessingStatus;
  durationMs: number;
};

export type ProcessPdfOptions = {
  signal?: AbortSignal;
};

export interface PdfProcessor {
  process(
    inputPath: string,
    originalFilename: string,
    options?: ProcessPdfOptions
  ): Promise<ProcessedPdf>;
  checkAvailability(): Promise<boolean>;
}

export class PdfProcessingError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = "PdfProcessingError";
    this.statusCode = statusCode;
    this.code = code;
  }
}
