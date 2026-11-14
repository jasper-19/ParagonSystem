import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  open,
  lstat,
  realpath,
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
import { AsyncSemaphore, ProcessingQueueError } from "./semaphore";
import {
  PdfProcessingError,
  type PdfProcessor,
  type ProcessedPdf,
  type ProcessPdfOptions,
} from "./pdf.types";

export type GhostscriptProcessorOptions = {
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
  totalTimeoutMs: number;
  maxQueuedProcesses: number;
  queueTimeoutMs: number;
  minCompressionInputBytes: number;
  minCompressionBytesPerPage: number;
  balancedImageDpi: number;
  maximumImageDpi: number;
  balancedJpegQFactor: number;
  maximumJpegQFactor: number;
  qpdfEnabled: boolean;
  qpdfExecutable: string;
  linearize: boolean;
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
  totalTimeoutMs: pdfConfig.totalProcessTimeoutMs,
  maxQueuedProcesses: pdfConfig.maxQueuedProcesses,
  queueTimeoutMs: pdfConfig.queueTimeoutMs,
  minCompressionInputBytes: pdfConfig.minCompressionInputBytes,
  minCompressionBytesPerPage: pdfConfig.minCompressionBytesPerPage,
  balancedImageDpi: pdfConfig.balancedImageDpi,
  maximumImageDpi: pdfConfig.maximumImageDpi,
  balancedJpegQFactor: pdfConfig.balancedJpegQFactor,
  maximumJpegQFactor: pdfConfig.maximumJpegQFactor,
  qpdfEnabled: pdfConfig.qpdfEnabled,
  qpdfExecutable: pdfConfig.qpdfExecutable,
  linearize: pdfConfig.linearize,
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

async function assertAllowedInputPath(
  filePath: string,
  allowedRoot: string
): Promise<void> {
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
  const physicalRelative = path.relative(await realpath(root), await realpath(resolved));
  if (physicalRelative.startsWith("..") || path.isAbsolute(physicalRelative) ||
      (await lstat(filePath)).isSymbolicLink()) {
    throw new PdfProcessingError("Invalid temporary PDF path", 400, "PDF_PATH_INVALID");
  }
}

async function sha256File(filePath: string, signal: AbortSignal): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath, { signal })) {
    hash.update(chunk as Buffer);
  }
  return hash.digest("hex");
}

function processingError(error: unknown): PdfProcessingError {
  if (error instanceof PdfProcessingError) return error;
  if (error instanceof CommandExecutionError) {
    if (error.resourceLimited) {
      return new PdfProcessingError("PDF processing exceeded its resource limit", 503, "PDF_PROCESS_RESOURCE_LIMIT");
    }
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
  private readonly availability = new Map<string, { expires: number; available: boolean }>();
  private readonly availabilityChecks = new Map<string, Promise<boolean>>();

  constructor(
    options: Partial<GhostscriptProcessorOptions> = {},
    private readonly runner: CommandRunner = new SpawnCommandRunner()
  ) {
    this.options = { ...defaultOptions, ...options };
    this.semaphore = new AsyncSemaphore(
      this.options.concurrency, this.options.maxQueuedProcesses, this.options.queueTimeoutMs
    );
  }

  private async executableAvailable(executable: string): Promise<boolean> {
    const cached = this.availability.get(executable);
    if (cached && cached.expires > performance.now()) return cached.available;
    const pending = this.availabilityChecks.get(executable);
    if (pending) return pending;
    const check = this.runner.run(executable, ["--version"], {
      timeoutMs: Math.min(this.options.timeoutMs, 5_000),
      maxOutputBytes: this.options.maxOutputBytes,
    }).then(() => true, () => false).then(available => {
      this.availability.set(executable, {
        available, expires: performance.now() + (available ? 30_000 : 5_000),
      });
      return available;
    }).finally(() => this.availabilityChecks.delete(executable));
    this.availabilityChecks.set(executable, check);
    return check;
  }

  async checkAvailability(): Promise<boolean> {
    return this.options.enabled && this.executableAvailable(this.options.executable);
  }

  async checkQpdfAvailability(): Promise<boolean> {
    return this.options.qpdfEnabled && this.executableAvailable(this.options.qpdfExecutable);
  }

  private async qpdfAvailableForRequest(signal: AbortSignal): Promise<boolean> {
    let onAbort: () => void = () => undefined;
    const cancelled = new Promise<never>((_resolve, reject) => {
      onAbort = (): void => reject(new CommandExecutionError("PDF processing was cancelled", {
        exitCode: null, timedOut: false, aborted: true,
      }));
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
    try {
      return await Promise.race([this.checkQpdfAvailability(), cancelled]);
    } finally {
      signal.removeEventListener("abort", onAbort);
    }
  }

  private commandOptions(signal: AbortSignal, outputPath?: string) {
    return {
      timeoutMs: this.options.timeoutMs,
      maxOutputBytes: this.options.maxOutputBytes,
      signal,
      ...(outputPath ? { outputFile: { path: outputPath, maxBytes: this.options.maxUploadBytes } } : {}),
    };
  }

  private async pageCount(filePath: string, signal: AbortSignal): Promise<number> {
    const result = await this.runner.run(this.options.executable, [
      "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dPDFSTOPONERROR", "-dNODISPLAY",
      `--permit-file-read=${filePath.replace(/\\/g, "/")}`,
      `-sPDFname=${filePath.replace(/\\/g, "/")}`,
      "-c", "PDFname (r) file runpdfbegin pdfpagecount = quit",
    ], this.commandOptions(signal));
    const match = result.stdout.trim().match(/(\d+)\s*$/);
    const count = match?.[1] ? Number(match[1]) : Number.NaN;
    if (!Number.isSafeInteger(count) || count < 1) {
      throw new PdfProcessingError("PDF has an invalid page structure", 400, "PDF_PAGE_COUNT_INVALID");
    }
    return count;
  }

  private compressionArguments(): string[] {
    if (this.options.profile !== "balanced" && this.options.profile !== "maximum") {
      return [`-dPDFSETTINGS=/${this.options.profile}`];
    }
    const dpi = this.options.profile === "balanced"
      ? this.options.balancedImageDpi : this.options.maximumImageDpi;
    return [
      "-sColorConversionStrategy=LeaveColorUnchanged",
      "-dPassThroughJPEGImages=true", "-dPassThroughJPXImages=true",
      "-dAutoFilterColorImages=true", "-dAutoFilterGrayImages=true",
      "-dDownsampleColorImages=true", "-dDownsampleGrayImages=true", "-dDownsampleMonoImages=true",
      "-dColorImageDownsampleType=/Bicubic", "-dGrayImageDownsampleType=/Bicubic",
      "-dMonoImageDownsampleType=/Subsample",
      `-dColorImageResolution=${dpi}`, `-dGrayImageResolution=${dpi}`,
      `-dMonoImageResolution=${this.options.profile === "balanced" ? 300 : 200}`,
    ];
  }

  private async validateRenderable(filePath: string, signal: AbortSignal): Promise<void> {
    // Interpret every page without allocating/storing page bitmaps. Page-count
    // parsing alone does not evaluate content streams, fonts or image resources.
    await this.runner.run(this.options.executable, [
      "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dPDFSTOPONERROR",
      "-sDEVICE=nullpage", filePath,
    ], this.commandOptions(signal));
  }

  private async textDigest(filePath: string, outputPath: string, signal: AbortSignal): Promise<string> {
    await this.runner.run(this.options.executable, [
      "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dPDFSTOPONERROR",
      "-sDEVICE=txtwrite", `-sOutputFile=${outputPath}`, filePath,
    ], this.commandOptions(signal, outputPath));
    const hash = createHash("sha256");
    let pendingWhitespace = false;
    let seenContent = false;
    // Decode across chunk boundaries and collapse layout whitespace while
    // preserving word boundaries. Never buffer the publication's extracted text.
    for await (const chunk of createReadStream(outputPath, { encoding: "utf8", signal })) {
      const normalized = String(chunk).replace(/\s+/g, " ");
      const content = normalized.trim();
      if (content) {
        if (seenContent && (pendingWhitespace || normalized.startsWith(" "))) hash.update(" ");
        hash.update(content);
        seenContent = true;
        pendingWhitespace = normalized.endsWith(" ");
      } else if (normalized.length) pendingWhitespace = true;
    }
    return hash.digest("hex");
  }

  private jpegArguments(): string[] {
    if (this.options.profile !== "balanced" && this.options.profile !== "maximum") return [];
    const qFactor = this.options.profile === "balanced"
      ? this.options.balancedJpegQFactor : this.options.maximumJpegQFactor;
    const samples = this.options.profile === "balanced" ? "1 1 1 1" : "2 1 1 2";
    // All tokens are static except bounded numeric server configuration. Keep
    // automatic JPEG/Flate selection rather than JPEG-encoding every diagram.
    const imageDict = `<< /QFactor ${qFactor} /Blend 1 /ColorTransform 1 /HSamples [${samples}] /VSamples [${samples}] >>`;
    return ["-c", `<< /ColorACSImageDict ${imageDict} /GrayACSImageDict ${imageDict} /ColorImageDict ${imageDict} /GrayImageDict ${imageDict} >> setdistillerparams`, "-f"];
  }

  private async compress(inputPath: string, outputPath: string, signal: AbortSignal): Promise<void> {
    await this.runner.run(this.options.executable, [
      "-q", "-dSAFER", "-dBATCH", "-dNOPAUSE", "-dPDFSTOPONERROR",
      "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7",
      ...this.compressionArguments(),
      "-dAutoRotatePages=/None", "-dDetectDuplicateImages=true",
      "-dCompressFonts=true", "-dSubsetFonts=true",
      `-sOutputFile=${outputPath}`, ...this.jpegArguments(), inputPath,
    ], this.commandOptions(signal, outputPath));
  }

  private async optimizeLosslessly(inputPath: string, outputPath: string, signal: AbortSignal): Promise<void> {
    await this.runner.run(this.options.qpdfExecutable, [
      "--object-streams=generate", "--stream-data=compress", "--decode-level=generalized",
      "--recompress-flate", "--compression-level=6",
      ...(this.options.linearize ? ["--linearize"] : []), inputPath, outputPath,
    ], this.commandOptions(signal, outputPath));
  }

  private async assertNotEncrypted(filePath: string, signal: AbortSignal): Promise<void> {
    try {
      // qpdf uses exit 0 for encrypted and exit 2 for not encrypted in this mode.
      await this.runner.run(this.options.qpdfExecutable, ["--is-encrypted", filePath], this.commandOptions(signal));
    } catch (error) {
      if (error instanceof CommandExecutionError && error.exitCode === 2 && !error.aborted && !error.timedOut && !error.resourceLimited) return;
      throw error;
    }
    throw new PdfProcessingError("Encrypted or password-protected PDFs are not supported", 400, "PDF_ENCRYPTED");
  }

  async process(inputPath: string, originalFilename: string, options: ProcessPdfOptions = {}): Promise<ProcessedPdf> {
    if (!this.options.enabled) {
      throw new PdfProcessingError("PDF processing is unavailable", 503, "PDF_PROCESSOR_DISABLED");
    }
    const startedAt = performance.now();
    let release: () => void;
    try {
      release = await this.semaphore.acquire(options.signal);
    } catch (error) {
      if (options.signal?.aborted) {
        throw new PdfProcessingError("PDF processing was cancelled", 499, "PDF_PROCESS_ABORTED");
      }
      if (error instanceof ProcessingQueueError) {
        throw new PdfProcessingError(error.message, error.statusCode, error.code);
      }
      throw error;
    }

    const controller = new AbortController();
    const queueDurationMs = performance.now() - startedAt;
    const onAbort = (): void => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.signal?.aborted) onAbort();
    let timedOut = false;
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, this.options.totalTimeoutMs);
    timeout.unref();
    const signal = controller.signal;
    const outputPath = path.join(path.dirname(inputPath), `${randomUUID()}.optimized.pdf`);
    const losslessPath = path.join(path.dirname(inputPath), `${randomUUID()}.lossless.pdf`);
    const originalTextPath = `${outputPath}.original.txt`;
    const candidateTextPath = `${outputPath}.candidate.txt`;
    let retainedPath: string | undefined;

    try {
      await assertAllowedInputPath(inputPath, this.options.allowedRoot);
      const originalSizeBytes = await inspectPdfContainer(inputPath, this.options.maxUploadBytes);
      let qpdfAvailable = await this.qpdfAvailableForRequest(signal);
      let qpdfProbeFailed = false;
      if (qpdfAvailable) {
        try { await this.assertNotEncrypted(inputPath, signal); }
        catch (error) {
          if (signal.aborted || (error instanceof CommandExecutionError && error.aborted) ||
              (error instanceof PdfProcessingError && error.code === "PDF_ENCRYPTED")) throw error;
          qpdfAvailable = false;
          qpdfProbeFailed = true;
        }
      }
      const pageCount = await this.pageCount(inputPath, signal);
      if (pageCount > this.options.maxPageCount) {
        throw new PdfProcessingError(`PDF exceeds the maximum page count of ${this.options.maxPageCount}`, 400, "PDF_PAGE_LIMIT_EXCEEDED");
      }
      await this.validateRenderable(inputPath, signal);
      let originalTextDigest: string | undefined;
      const assertTextPreserved = async (candidate: string): Promise<void> => {
        originalTextDigest ??= await this.textDigest(inputPath, originalTextPath, signal);
        if (originalTextDigest !== await this.textDigest(candidate, candidateTextPath, signal)) {
          throw new PdfProcessingError("Optimized PDF changed searchable text", 500, "PDF_TEXT_CHANGED");
        }
      };
      let selectedPath = inputPath;
      let selectedSize = originalSizeBytes;
      let processor = "original";
      let status: ProcessedPdf["status"] = "no-benefit";
      let optimizationReason: NonNullable<ProcessedPdf["optimizationReason"]> = "no-savings";
      let qpdfStatus: NonNullable<ProcessedPdf["qpdfStatus"]> = this.options.qpdfEnabled ? "unavailable" : "disabled";
      if (qpdfProbeFailed) qpdfStatus = "failed";
      const savings = (size: number): number => ((originalSizeBytes - size) / originalSizeBytes) * 100;
      const isBeneficial = (size: number): boolean => size < originalSizeBytes && savings(size) >= this.options.minSavingsPercent;
      const shouldCompress = this.options.profile !== "high-quality" &&
        originalSizeBytes >= this.options.minCompressionInputBytes &&
        originalSizeBytes / pageCount >= this.options.minCompressionBytesPerPage;
      if (!shouldCompress) {
        optimizationReason = this.options.profile === "high-quality" ? "high-quality-original" : "below-threshold";
      }

      if (shouldCompress) {
        try {
          await this.compress(inputPath, outputPath, signal);
          const size = await inspectPdfContainer(outputPath, this.options.maxUploadBytes);
          if (isBeneficial(size) && await this.pageCount(outputPath, signal) !== pageCount) {
            throw new PdfProcessingError("Optimized PDF did not preserve all pages", 500, "PDF_PAGE_COUNT_CHANGED");
          }
          if (isBeneficial(size)) {
            await this.validateRenderable(outputPath, signal);
            await assertTextPreserved(outputPath);
            selectedPath = outputPath;
            selectedSize = size;
            processor = "ghostscript";
            status = "optimized";
            optimizationReason = "compressed";
          }
        } catch (error) {
          if (signal.aborted || (error instanceof CommandExecutionError && error.aborted) ||
              this.options.fallback === "reject" ||
              (error instanceof PdfProcessingError && error.code === "PDF_PAGE_COUNT_CHANGED")) throw error;
          status = "compression-fallback";
          optimizationReason = error instanceof PdfProcessingError && error.code === "PDF_TEXT_CHANGED"
            ? "text-changed" : "compression-failed";
        }
      }

      if (qpdfAvailable) {
        qpdfStatus = "no-savings";
        try {
          await this.optimizeLosslessly(selectedPath, losslessPath, signal);
          const size = await inspectPdfContainer(losslessPath, this.options.maxUploadBytes);
          if (size <= selectedSize && isBeneficial(size)) {
            // Non-zero exits, including exit 3 (warnings), discard the optional
            // candidate. --check also validates its linearization hint tables.
            await this.runner.run(this.options.qpdfExecutable, ["--check", losslessPath], this.commandOptions(signal));
            if (await this.pageCount(losslessPath, signal) !== pageCount) {
              throw new PdfProcessingError("Lossless PDF did not preserve all pages", 500, "PDF_PAGE_COUNT_CHANGED");
            }
            await this.validateRenderable(losslessPath, signal);
            await assertTextPreserved(losslessPath);
            selectedPath = losslessPath;
            selectedSize = size;
            processor = processor === "ghostscript" ? "ghostscript+qpdf" : "qpdf";
            status = "optimized";
            optimizationReason = processor === "ghostscript+qpdf" ? "compressed" : "lossless";
            qpdfStatus = "selected";
          }
        } catch (error) {
          qpdfStatus = "failed";
          if (signal.aborted || (error instanceof CommandExecutionError && error.aborted)) throw error;
          // Optional optimizer failures retain the already validated selection.
        }
      }
      if (signal.aborted) throw new CommandExecutionError("PDF processing was cancelled", {
        exitCode: null, timedOut: false, aborted: true,
      });
      const sha256 = await sha256File(selectedPath, signal);
      if (selectedPath !== inputPath) retainedPath = selectedPath;
      return {
        filePath: selectedPath,
        ...(retainedPath ? { temporaryOutputPath: retainedPath } : {}),
        originalFilename: normalizeFilename(originalFilename), originalSizeBytes,
        optimizedSizeBytes: selectedSize,
        compressionPercent: selectedSize < originalSizeBytes ? Number(savings(selectedSize).toFixed(2)) : 0,
        pageCount, sha256, processor, profile: this.options.profile, status,
        optimizationReason, qpdfStatus, queueDurationMs,
        durationMs: performance.now() - startedAt,
      };
    } catch (error) {
      if (options.signal?.aborted) {
        throw new PdfProcessingError("PDF processing was cancelled", 499, "PDF_PROCESS_ABORTED");
      }
      if (timedOut) throw new PdfProcessingError("PDF processing timed out", 503, "PDF_PROCESS_TIMEOUT");
      throw processingError(error);
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
      for (const candidate of [outputPath, losslessPath, originalTextPath, candidateTextPath]) {
        if (candidate !== retainedPath) await unlink(candidate).catch(() => undefined);
      }
      release();
    }
  }
}

export const pdfProcessor = new GhostscriptPdfProcessor();
