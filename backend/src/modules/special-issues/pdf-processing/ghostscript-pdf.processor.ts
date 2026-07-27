import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  open,
  stat,
  unlink,
} from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import {
  pdfConfig,
  type PdfCompressionFallback,
  type PdfCompressionProfile,
} from "../../../config/pdf";
import {
  CommandExecutionError,
  type CommandRunner,
  SpawnCommandRunner,
} from "./command-runner";
import { AsyncSemaphore } from "./semaphore";
import {
  PdfProcessingError,
  type PdfProcessor,
  type ProcessedPdf,
  type ProcessPdfOptions,
} from "./pdf.types";

type GhostscriptProcessorOptions = {
  enabled: boolean;
  executable: string;
  profile: PdfCompressionProfile;
  fallback: PdfCompressionFallback;
  minSavingsPercent: number;
  maxUploadBytes: number;
  maxPageCount: number;
  timeoutMs: number;
  maxOutputBytes: number;
  concurrency: number;
  allowedRoot: string;
};

const defaultOptions: GhostscriptProcessorOptions = {
  enabled: pdfConfig.enabled,
  executable: pdfConfig.executable,
  profile: pdfConfig.compressionProfile,
  fallback: pdfConfig.compressionFallback,
  minSavingsPercent: pdfConfig.minSavingsPercent,
  maxUploadBytes: pdfConfig.maxUploadBytes,
  maxPageCount: pdfConfig.maxPageCount,
  timeoutMs: pdfConfig.processTimeoutMs,
  maxOutputBytes: pdfConfig.maxProcessOutputBytes,
  concurrency: pdfConfig.processingConcurrency,
  allowedRoot: pdfConfig.tempRoot,
};

function normalizeFilename(originalFilename: string): string {
  const withoutPath = path.basename(String(originalFilename || "document"));
  const withoutExtension = withoutPath.replace(/\.[^/.]+$/, "");
  const normalized = withoutExtension
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .slice(0, 100);
  return `${normalized || "document"}.pdf`;
}

async function inspectPdfContainer(
  filePath: string,
  maxUploadBytes: number
): Promise<number> {
  const fileStat = await stat(filePath);
  if (!fileStat.isFile() || fileStat.size === 0) {
    throw new PdfProcessingError("Uploaded PDF is empty", 400, "PDF_EMPTY");
  }
  if (fileStat.size > maxUploadBytes) {
    throw new PdfProcessingError(
      "Uploaded PDF exceeds the configured limit",
      413,
      "PDF_TOO_LARGE"
    );
  }

  const handle = await open(filePath, "r");
  try {
    const header = Buffer.alloc(Math.min(8, fileStat.size));
    await handle.read(header, 0, header.length, 0);
    if (!/^%PDF-\d\.\d/.test(header.toString("ascii"))) {
      throw new PdfProcessingError(
        "Uploaded file is not a supported PDF",
        400,
        "PDF_SIGNATURE_INVALID"
      );
    }

    const tailLength = Math.min(fileStat.size, 1024 * 1024);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, fileStat.size - tailLength);
    const tailText = tail.toString("latin1");

    if (!tailText.includes("%%EOF") || !tailText.includes("startxref")) {
      throw new PdfProcessingError(
        "PDF is corrupted or incomplete",
        400,
        "PDF_STRUCTURE_INVALID"
      );
    }
    if (/\/Encrypt\b/.test(tailText)) {
      throw new PdfProcessingError(
        "Encrypted or password-protected PDFs are not supported",
        400,
        "PDF_ENCRYPTED"
      );
    }
  } finally {
    await handle.close();
  }

  return fileStat.size;
}

function assertAllowedInputPath(
  filePath: string,
  allowedRoot: string
): void {
  const root = path.resolve(allowedRoot);
  const resolved = path.resolve(filePath);
  const relative = path.relative(root, resolved);
  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    path.extname(resolved).toLowerCase() !== ".pdf"
  ) {
    throw new PdfProcessingError(
      "Invalid temporary PDF path",
      400,
      "PDF_PATH_INVALID"
    );
  }
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

function processingError(error: unknown): PdfProcessingError {
  if (error instanceof PdfProcessingError) return error;
  if (error instanceof CommandExecutionError) {
    if (error.timedOut) {
      return new PdfProcessingError(
        "PDF processing timed out",
        503,
        "PDF_PROCESS_TIMEOUT"
      );
    }
    if (error.aborted) {
      return new PdfProcessingError(
        "PDF processing was cancelled",
        499,
        "PDF_PROCESS_ABORTED"
      );
    }
    if (error.exitCode === null) {
      return new PdfProcessingError(
        "PDF processing service is unavailable",
        503,
        "PDF_PROCESSOR_UNAVAILABLE"
      );
    }
  }
  return new PdfProcessingError(
    "PDF could not be safely processed",
    400,
    "PDF_PROCESS_FAILED"
  );
}

export class GhostscriptPdfProcessor implements PdfProcessor {
  private readonly options: GhostscriptProcessorOptions;
  private readonly semaphore: AsyncSemaphore;

  constructor(
    options: Partial<GhostscriptProcessorOptions> = {},
    private readonly runner: CommandRunner = new SpawnCommandRunner()
  ) {
    this.options = { ...defaultOptions, ...options };
    this.semaphore = new AsyncSemaphore(this.options.concurrency);
  }

  async checkAvailability(): Promise<boolean> {
    if (!this.options.enabled) return false;
    try {
      await this.runner.run(this.options.executable, ["--version"], {
        timeoutMs: Math.min(this.options.timeoutMs, 5_000),
        maxOutputBytes: this.options.maxOutputBytes,
      });
      return true;
    } catch {
      return false;
    }
  }

  private async pageCount(
    filePath: string,
    signal?: AbortSignal
  ): Promise<number> {
    const ghostscriptPath = filePath.replace(/\\/g, "/");
    const result = await this.runner.run(
      this.options.executable,
      [
        "-q",
        "-dSAFER",
        "-dBATCH",
        "-dNOPAUSE",
        "-dNODISPLAY",
        `-sPDFname=${ghostscriptPath}`,
        "-c",
        "PDFname (r) file runpdfbegin pdfpagecount = quit",
      ],
      {
        timeoutMs: this.options.timeoutMs,
        maxOutputBytes: this.options.maxOutputBytes,
        ...(signal ? { signal } : {}),
      }
    );

    const match = result.stdout.trim().match(/(\d+)\s*$/);
    const count = match?.[1] ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new PdfProcessingError(
        "PDF has an invalid page structure",
        400,
        "PDF_PAGE_COUNT_INVALID"
      );
    }
    return count;
  }

  private async compress(
    inputPath: string,
    outputPath: string,
    signal?: AbortSignal
  ): Promise<void> {
    await this.runner.run(
      this.options.executable,
      [
        "-q",
        "-dSAFER",
        "-dBATCH",
        "-dNOPAUSE",
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.7",
        `-dPDFSETTINGS=/${this.options.profile}`,
        "-dAutoRotatePages=/None",
        "-dDetectDuplicateImages=true",
        "-dCompressFonts=true",
        "-dSubsetFonts=true",
        `-sOutputFile=${outputPath}`,
        inputPath,
      ],
      {
        timeoutMs: this.options.timeoutMs,
        maxOutputBytes: this.options.maxOutputBytes,
        ...(signal ? { signal } : {}),
      }
    );
  }

  async process(
    inputPath: string,
    originalFilename: string,
    options: ProcessPdfOptions = {}
  ): Promise<ProcessedPdf> {
    if (!this.options.enabled) {
      throw new PdfProcessingError(
        "PDF processing is unavailable",
        503,
        "PDF_PROCESSOR_DISABLED"
      );
    }

    const startedAt = performance.now();
    assertAllowedInputPath(inputPath, this.options.allowedRoot);
    const originalSizeBytes = await inspectPdfContainer(
      inputPath,
      this.options.maxUploadBytes
    );
    const release = await this.semaphore.acquire(options.signal);
    const outputPath = path.join(
      path.dirname(inputPath),
      `${randomUUID()}.optimized.pdf`
    );

    try {
      const pageCount = await this.pageCount(inputPath, options.signal);
      if (pageCount > this.options.maxPageCount) {
        throw new PdfProcessingError(
          `PDF exceeds the maximum page count of ${this.options.maxPageCount}`,
          400,
          "PDF_PAGE_LIMIT_EXCEEDED"
        );
      }

      try {
        await this.compress(inputPath, outputPath, options.signal);
        const candidateSize = await inspectPdfContainer(
          outputPath,
          this.options.maxUploadBytes
        );
        const outputPageCount = await this.pageCount(outputPath, options.signal);
        if (outputPageCount !== pageCount) {
          throw new PdfProcessingError(
            "Optimized PDF did not preserve all pages",
            500,
            "PDF_PAGE_COUNT_CHANGED"
          );
        }

        const savingsPercent =
          ((originalSizeBytes - candidateSize) / originalSizeBytes) * 100;
        const useOptimized =
          candidateSize < originalSizeBytes &&
          savingsPercent >= this.options.minSavingsPercent;
        const selectedPath = useOptimized ? outputPath : inputPath;
        if (!useOptimized) await unlink(outputPath).catch(() => undefined);

        return {
          filePath: selectedPath,
          ...(useOptimized ? { temporaryOutputPath: outputPath } : {}),
          originalFilename: normalizeFilename(originalFilename),
          originalSizeBytes,
          optimizedSizeBytes: useOptimized
            ? candidateSize
            : originalSizeBytes,
          compressionPercent: useOptimized
            ? Number(savingsPercent.toFixed(2))
            : 0,
          pageCount,
          sha256: await sha256File(selectedPath),
          processor: "ghostscript",
          profile: this.options.profile,
          status: useOptimized ? "optimized" : "no-benefit",
          durationMs: performance.now() - startedAt,
        };
      } catch (error) {
        await unlink(outputPath).catch(() => undefined);
        if (
          this.options.fallback === "original" &&
          !(error instanceof PdfProcessingError &&
            error.code === "PDF_PAGE_COUNT_CHANGED")
        ) {
          return {
            filePath: inputPath,
            originalFilename: normalizeFilename(originalFilename),
            originalSizeBytes,
            optimizedSizeBytes: originalSizeBytes,
            compressionPercent: 0,
            pageCount,
            sha256: await sha256File(inputPath),
            processor: "ghostscript",
            profile: this.options.profile,
            status: "compression-fallback",
            durationMs: performance.now() - startedAt,
          };
        }
        throw error;
      }
    } catch (error) {
      await unlink(outputPath).catch(() => undefined);
      throw processingError(error);
    } finally {
      release();
    }
  }
}

export const pdfProcessor = new GhostscriptPdfProcessor();
