import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CommandExecutionError,
  type CommandResult,
  type CommandRunOptions,
  type CommandRunner,
} from "./command-runner";
import { GhostscriptPdfProcessor } from "./ghostscript-pdf.processor";
import { PdfProcessingError } from "./pdf.types";

function pdfBytes(payloadBytes: number, extraTrailer = ""): Buffer {
  const padding = "A".repeat(Math.max(payloadBytes, 0));
  return Buffer.from(
    `%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n${padding}\nstartxref\n9\n${extraTrailer}\n%%EOF\n`
  );
}

class FakeGhostscriptRunner implements CommandRunner {
  calls: Array<{ executable: string; args: readonly string[]; options: CommandRunOptions }> = [];
  compressionError?: Error;
  renderErrorSuffix?: string;
  outputBytes = pdfBytes(64);
  pageCount = 3;
  changedText = false;
  candidateText?: string;

  async run(
    executable: string,
    args: readonly string[],
    options: CommandRunOptions
  ): Promise<CommandResult> {
    this.calls.push({ executable, args, options });
    if (args.includes("--version")) {
      return { stdout: "10.0\n", stderr: "", durationMs: 1 };
    }
    if (args.includes("-dNODISPLAY")) {
      return {
        stdout: `${this.pageCount}\n`,
        stderr: "",
        durationMs: 1,
      };
    }
    if (args.includes("-sDEVICE=nullpage")) {
      if (this.renderErrorSuffix && args.some(arg => arg.endsWith(this.renderErrorSuffix!))) {
        throw new CommandExecutionError("invalid page content", { exitCode: 1, timedOut: false, aborted: false });
      }
      return { stdout: "", stderr: "", durationMs: 1 };
    }
    if (args.includes("-sDEVICE=txtwrite")) {
      const output = args.find(arg => arg.startsWith("-sOutputFile="))!;
      await writeFile(output.slice("-sOutputFile=".length),
        args.at(-1)?.endsWith(".optimized.pdf")
          ? this.candidateText ?? (this.changedText ? "changed searchable text" : "original searchable text")
          : "original searchable text");
      return { stdout: "", stderr: "", durationMs: 1 };
    }
    if (this.compressionError) throw this.compressionError;

    const outputArg = args.find(argument =>
      argument.startsWith("-sOutputFile=")
    );
    assert.ok(outputArg);
    await writeFile(outputArg.slice("-sOutputFile=".length), this.outputBytes);
    return { stdout: "", stderr: "", durationMs: 1 };
  }
}

async function fixture(): Promise<{
  directory: string;
  inputPath: string;
}> {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-pdf-test-")
  );
  const inputPath = path.join(directory, `${randomUUID()}.pdf`);
  await writeFile(inputPath, pdfBytes(4096));
  return { directory, inputPath };
}

function processor(
  runner: FakeGhostscriptRunner,
  overrides: ConstructorParameters<typeof GhostscriptPdfProcessor>[0] = {}
) {
  return new GhostscriptPdfProcessor(
    {
      enabled: true,
      executable: "fake-gs",
      profile: "ebook",
      fallback: "original",
      minSavingsPercent: 5,
      maxUploadBytes: 1024 * 1024,
      maxPageCount: 100,
      timeoutMs: 1_000,
      maxOutputBytes: 16 * 1024,
      concurrency: 1,
      minCompressionInputBytes: 0,
      minCompressionBytesPerPage: 0,
      qpdfEnabled: false,
      ...overrides,
    },
    runner
  );
}

test("optimizes a structurally valid PDF and normalizes its filename", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  try {
    const result = await processor(runner, { allowedRoot: directory }).process(
      inputPath,
      "../../unsafe publication.exe"
    );

    assert.equal(result.status, "optimized");
    assert.equal(result.pageCount, 3);
    assert.equal(result.originalFilename, "unsafe-publication.pdf");
    assert.ok(result.optimizedSizeBytes < result.originalSizeBytes);
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    assert.ok(result.temporaryOutputPath);
    assert.deepEqual(
      await readFile(result.filePath),
      runner.outputBytes
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retains the original and removes temporary text when a candidate changes searchable characters", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.changedText = true;
  try {
    const result = await processor(runner, { allowedRoot: directory }).process(inputPath, "issue.pdf");
    assert.equal(result.filePath, inputPath);
    assert.equal(result.status, "compression-fallback");
    assert.equal(result.optimizationReason, "text-changed");
    assert.deepEqual(await readdir(directory), [path.basename(inputPath)]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("keeps the original when compression has no meaningful benefit", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.outputBytes = await readFile(inputPath);
  try {
    const result = await processor(runner, {
      allowedRoot: directory,
    }).process(inputPath, "issue.pdf");
    assert.equal(result.status, "no-benefit");
    assert.equal(result.filePath, inputPath);
    assert.equal(result.compressionPercent, 0);
    assert.equal(result.temporaryOutputPath, undefined);
    assert.equal(runner.calls.filter(call => call.args.includes("-dNODISPLAY")).length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("text validation tolerates layout whitespace but preserves word boundaries", async () => {
  const { directory, inputPath } = await fixture();
  try {
    const runner = new FakeGhostscriptRunner();
    runner.candidateText = "\n original\n\tsearchable   text \n";
    const matching = await processor(runner, { allowedRoot: directory }).process(inputPath, "issue.pdf");
    assert.equal(matching.status, "optimized");
    runner.candidateText = "originalsearchable text";
    const changed = await processor(runner, { allowedRoot: directory }).process(inputPath, "issue.pdf");
    assert.equal(changed.filePath, inputPath);
    assert.equal(changed.optimizationReason, "text-changed");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("falls back to a validated original after compression failure", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.compressionError = new CommandExecutionError(
    "processor failed",
    { exitCode: 1, timedOut: false, aborted: false }
  );
  try {
    const result = await processor(runner, {
      allowedRoot: directory,
    }).process(inputPath, "issue.pdf");
    assert.equal(result.status, "compression-fallback");
    assert.equal(result.filePath, inputPath);
    assert.equal(result.optimizedSizeBytes, result.originalSizeBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects a compression timeout when fallback policy is reject", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.compressionError = new CommandExecutionError(
    "processor timed out",
    { exitCode: null, timedOut: true, aborted: false }
  );
  try {
    await assert.rejects(
      processor(runner, {
        allowedRoot: directory,
        fallback: "reject",
      }).process(inputPath, "issue.pdf"),
      (error: unknown) =>
        error instanceof PdfProcessingError &&
        error.code === "PDF_PROCESS_TIMEOUT"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects encrypted and incomplete PDFs before compression", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-pdf-test-")
  );
  const encryptedPath = path.join(directory, "encrypted.pdf");
  const corruptPath = path.join(directory, "corrupt.pdf");
  await writeFile(encryptedPath, pdfBytes(10, "/Encrypt 8 0 R"));
  await writeFile(corruptPath, Buffer.from("%PDF-1.7\nincomplete"));
  const instance = processor(new FakeGhostscriptRunner(), {
    allowedRoot: directory,
  });

  try {
    await assert.rejects(
      instance.process(encryptedPath, "encrypted.pdf"),
      (error: unknown) =>
        error instanceof PdfProcessingError &&
        error.code === "PDF_ENCRYPTED"
    );
    await assert.rejects(
      instance.process(corruptPath, "corrupt.pdf"),
      (error: unknown) =>
        error instanceof PdfProcessingError &&
        error.code === "PDF_STRUCTURE_INVALID"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects empty, spoofed, and oversized files", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-pdf-test-")
  );
  const emptyPath = path.join(directory, "empty.pdf");
  const spoofedPath = path.join(directory, "spoofed.pdf");
  const oversizedPath = path.join(directory, "oversized.pdf");
  await writeFile(emptyPath, Buffer.alloc(0));
  await writeFile(spoofedPath, Buffer.from("not a pdf"));
  await writeFile(oversizedPath, pdfBytes(4096));
  const runner = new FakeGhostscriptRunner();

  try {
    for (const [filePath, code, maxUploadBytes] of [
      [emptyPath, "PDF_EMPTY", 1024 * 1024],
      [spoofedPath, "PDF_SIGNATURE_INVALID", 1024 * 1024],
      [oversizedPath, "PDF_TOO_LARGE", 128],
    ] as const) {
      await assert.rejects(
        processor(runner, {
          allowedRoot: directory,
          maxUploadBytes,
        }).process(filePath, "issue.pdf"),
        (error: unknown) =>
          error instanceof PdfProcessingError && error.code === code
      );
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("refuses to process a path outside the upload root", async () => {
  const { directory, inputPath } = await fixture();
  try {
    await assert.rejects(
      processor(new FakeGhostscriptRunner(), {
        allowedRoot: path.join(directory, "different-root"),
      }).process(inputPath, "issue.pdf"),
      (error: unknown) =>
        error instanceof PdfProcessingError &&
        error.code === "PDF_PATH_INVALID"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("rejects PDFs over the configured page limit", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.pageCount = 101;
  try {
    await assert.rejects(
      processor(runner, { allowedRoot: directory }).process(
        inputPath,
        "large.pdf"
      ),
      (error: unknown) =>
        error instanceof PdfProcessingError &&
        error.code === "PDF_PAGE_LIMIT_EXCEEDED"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("removes the candidate when compression is not selected", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.outputBytes = await readFile(inputPath);
  try {
    await processor(runner, { allowedRoot: directory }).process(
      inputPath,
      "issue.pdf"
    );
    const remaining = await stat(inputPath);
    assert.ok(remaining.isFile());
    assert.deepEqual(await readdir(directory), [path.basename(inputPath)]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("never falls back to the original after compression is cancelled", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.compressionError = new CommandExecutionError("cancelled", {
    exitCode: null, timedOut: false, aborted: true,
  });
  try {
    await assert.rejects(
      processor(runner, { allowedRoot: directory }).process(inputPath, "issue.pdf"),
      error => error instanceof PdfProcessingError && error.code === "PDF_PROCESS_ABORTED"
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("high quality retains the original instead of applying a lossy preset", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  try {
    const result = await processor(runner, { allowedRoot: directory, profile: "high-quality" }).process(inputPath, "issue.pdf");
    assert.equal(result.filePath, inputPath);
    assert.equal(result.optimizedSizeBytes, result.originalSizeBytes);
    assert.equal(result.optimizationReason, "high-quality-original");
    assert.equal(runner.calls.some(call => call.args.includes("-sDEVICE=pdfwrite")), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("adaptive thresholds avoid compression for a small or compact-per-page input", async () => {
  const { directory, inputPath } = await fixture();
  try {
    for (const thresholds of [{ minCompressionInputBytes: 256 * 1024 }, { minCompressionBytesPerPage: 64 * 1024 }]) {
      const runner = new FakeGhostscriptRunner();
      const result = await processor(runner, { allowedRoot: directory, ...thresholds }).process(inputPath, "issue.pdf");
      assert.equal(result.optimizationReason, "below-threshold");
      assert.equal(result.filePath, inputPath);
      assert.equal(runner.calls.length, 2);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("named compression profiles use explicit image controls on the pdfwrite device", async () => {
  const { directory, inputPath } = await fixture();
  try {
    for (const [profile, dpi] of [["balanced", 150], ["maximum", 96]] as const) {
      const runner = new FakeGhostscriptRunner();
      await processor(runner, { allowedRoot: directory, profile }).process(inputPath, "issue.pdf");
      const command = runner.calls.find(call => call.args.includes("-sDEVICE=pdfwrite"));
      assert.ok(command);
      assert.ok(command.args.includes(`-dColorImageResolution=${dpi}`));
      assert.ok(command.args.includes("-dSAFER"));
      assert.ok(command.args.includes("-dPassThroughJPEGImages=true"));
      const controls = command.args[command.args.indexOf("-c") + 1]!;
      assert.ok(controls.includes(`/QFactor ${profile === "balanced" ? 0.4 : 0.76}`));
      assert.ok(controls.includes("/ColorImageDict"));
      assert.ok(controls.includes("/GrayImageDict"));
      assert.ok(command.args.includes("-f"));
      assert.equal(command.args.some(arg => arg.startsWith("-dJPEGQ=")), false);
      assert.equal(command.args.some(arg => arg.startsWith("-dPDFSETTINGS=")), false);
      assert.ok(command.options.outputFile);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

class FakeQpdfRunner extends FakeGhostscriptRunner {
  losslessBytes = pdfBytes(48);
  qpdfUnavailable = false;
  qpdfWarning = false;
  qpdfEncrypted = false;
  losePage = false;

  override async run(executable: string, args: readonly string[], options: CommandRunOptions): Promise<CommandResult> {
    if (executable !== "fake-qpdf") {
      const result = await super.run(executable, args, options);
      if (this.losePage && args.some(arg => arg.endsWith(".lossless.pdf"))) return { ...result, stdout: "2\n" };
      return result;
    }
    this.calls.push({ executable, args, options });
    if (this.qpdfUnavailable) throw new CommandExecutionError("missing", { exitCode: null, timedOut: false, aborted: false });
    if (args.includes("--is-encrypted") && !this.qpdfEncrypted) {
      throw new CommandExecutionError("not encrypted", { exitCode: 2, timedOut: false, aborted: false });
    }
    if (args.includes("--check") && this.qpdfWarning) {
      throw new CommandExecutionError("warning", { exitCode: 3, timedOut: false, aborted: false });
    }
    if (args.includes("--object-streams=generate")) await writeFile(args[args.length - 1]!, this.losslessBytes);
    return { stdout: "", stderr: "", durationMs: 1 };
  }
}

test("optional lossless optimization validates structure, linearization and page parity", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeQpdfRunner();
  try {
    const result = await processor(runner, { allowedRoot: directory, profile: "high-quality", qpdfEnabled: true, qpdfExecutable: "fake-qpdf", linearize: true }).process(inputPath, "issue.pdf");
    assert.equal(result.processor, "qpdf");
    assert.equal(result.qpdfStatus, "selected");
    assert.equal(result.optimizationReason, "lossless");
    assert.ok(result.optimizedSizeBytes < result.originalSizeBytes);
    assert.ok(runner.calls.some(call => call.args.includes("--linearize")));
    assert.ok(runner.calls.some(call => call.args.includes("--check")));
    assert.equal(runner.calls.filter(call => call.args.includes("-dNODISPLAY")).length, 2);
    assert.equal(runner.calls.some(call => call.args.includes("--optimize-images")), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unavailable, warning, larger or page-changing qpdf output safely retains the original", async () => {
  const { directory, inputPath } = await fixture();
  try {
    for (const scenario of ["unavailable", "warning", "larger", "page-change"] as const) {
      const runner = new FakeQpdfRunner();
      runner.qpdfUnavailable = scenario === "unavailable";
      runner.qpdfWarning = scenario === "warning";
      runner.losePage = scenario === "page-change";
      if (scenario === "larger") runner.losslessBytes = pdfBytes(8192);
      const result = await processor(runner, { allowedRoot: directory, profile: "high-quality", qpdfEnabled: true, qpdfExecutable: "fake-qpdf" }).process(inputPath, "issue.pdf");
      assert.equal(result.filePath, inputPath, scenario);
      assert.equal(result.optimizedSizeBytes, result.originalSizeBytes, scenario);
      assert.deepEqual(await readdir(directory), [path.basename(inputPath)]);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("qpdf encryption inspection rejects encrypted input before compression", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeQpdfRunner();
  runner.qpdfEncrypted = true;
  try {
    await assert.rejects(processor(runner, { allowedRoot: directory, qpdfEnabled: true, qpdfExecutable: "fake-qpdf" }).process(inputPath, "issue.pdf"),
      error => error instanceof PdfProcessingError && error.code === "PDF_ENCRYPTED");
    assert.equal(runner.calls.some(call => call.args.includes("-sDEVICE=pdfwrite")), false);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("availability probes share a native process and cache repeated readiness checks", async () => {
  const runner = new FakeGhostscriptRunner();
  const instance = processor(runner);
  assert.deepEqual(await Promise.all(Array.from({ length: 20 }, () => instance.checkAvailability())), Array(20).fill(true));
  await instance.checkAvailability();
  assert.equal(runner.calls.length, 1);
});

test("the total processing deadline is not swallowed by original fallback", async () => {
  const { directory, inputPath } = await fixture();
  const runner: CommandRunner = {
    run: async (_executable, _args, options) => new Promise((_resolve, reject) => {
      const onAbort = (): void => {
        clearTimeout(wait);
        reject(new CommandExecutionError("cancelled", { exitCode: null, timedOut: false, aborted: true }));
      };
      const wait = setTimeout(onAbort, 2_000);
      options.signal?.addEventListener("abort", onAbort, { once: true });
      if (options.signal?.aborted) onAbort();
    }),
  };
  try {
    const instance = new GhostscriptPdfProcessor({ allowedRoot: directory, enabled: true, qpdfEnabled: false, totalTimeoutMs: 20, fallback: "original" }, runner);
    await assert.rejects(instance.process(inputPath, "issue.pdf"), error => error instanceof PdfProcessingError && error.code === "PDF_PROCESS_TIMEOUT");
    assert.deepEqual(await readdir(directory), [path.basename(inputPath)]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("request cancellation does not wait for a shared availability probe", async () => {
  const { directory, inputPath } = await fixture();
  let startProbe: () => void = () => undefined;
  let finishProbe: () => void = () => undefined;
  const started = new Promise<void>(resolve => { startProbe = resolve; });
  const pending = new Promise<void>(resolve => { finishProbe = resolve; });
  const runner = new FakeQpdfRunner();
  const originalRun = runner.run.bind(runner);
  runner.run = async (executable, args, options) => {
    if (executable === "fake-qpdf" && args.includes("--version")) {
      startProbe();
      await pending;
    }
    return originalRun(executable, args, options);
  };
  const controller = new AbortController();
  try {
    const operation = processor(runner, { allowedRoot: directory, qpdfEnabled: true, qpdfExecutable: "fake-qpdf" }).process(inputPath, "issue.pdf", { signal: controller.signal });
    const rejected = assert.rejects(operation, error => error instanceof PdfProcessingError && error.code === "PDF_PROCESS_ABORTED");
    await started;
    controller.abort();
    await rejected;
  } finally {
    finishProbe();
    await rm(directory, { recursive: true, force: true });
  }
});

test("originals with invalid page content cannot bypass validation via an adaptive skip", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.renderErrorSuffix = path.basename(inputPath);
  try {
    await assert.rejects(processor(runner, { allowedRoot: directory, profile: "high-quality" }).process(inputPath, "issue.pdf"),
      error => error instanceof PdfProcessingError && error.code === "PDF_PROCESS_FAILED");
    assert.deepEqual(await readdir(directory), [path.basename(inputPath)]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("unrenderable optimized content falls back only to an already validated original", async () => {
  const { directory, inputPath } = await fixture();
  const runner = new FakeGhostscriptRunner();
  runner.renderErrorSuffix = ".optimized.pdf";
  try {
    const result = await processor(runner, { allowedRoot: directory }).process(inputPath, "issue.pdf");
    assert.equal(result.filePath, inputPath);
    assert.equal(result.status, "compression-fallback");
    assert.equal(result.optimizationReason, "compression-failed");
    assert.deepEqual(await readdir(directory), [path.basename(inputPath)]);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
