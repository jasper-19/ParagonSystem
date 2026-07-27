import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  compressionError?: Error;
  outputBytes = pdfBytes(64);
  pageCount = 3;

  async run(
    _executable: string,
    args: readonly string[],
    _options: CommandRunOptions
  ): Promise<CommandResult> {
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
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
