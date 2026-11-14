import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  CommandExecutionError,
  SpawnCommandRunner,
} from "./command-runner";

test("terminates a child process after the configured timeout", async () => {
  const runner = new SpawnCommandRunner();
  await assert.rejects(
    runner.run(
      process.execPath,
      ["-e", "setInterval(() => undefined, 1000)"],
      { timeoutMs: 100, maxOutputBytes: 1024 }
    ),
    (error: unknown) =>
      error instanceof CommandExecutionError && error.timedOut
  );
});

test("terminates a child process that exceeds its output budget", async () => {
  const runner = new SpawnCommandRunner();
  await assert.rejects(
    runner.run(
      process.execPath,
      ["-e", "process.stdout.write('x'.repeat(2048))"],
      { timeoutMs: 10_000, maxOutputBytes: 128 }
    ),
    (error: unknown) =>
      error instanceof CommandExecutionError &&
      error.message.includes("output limit")
  );
});

test("rejects an already cancelled operation before starting a child", async () => {
  await assert.rejects(
    new SpawnCommandRunner().run("must-not-be-spawned", [], {
      timeoutMs: 1_000, maxOutputBytes: 128, signal: AbortSignal.abort(),
    }),
    error => error instanceof CommandExecutionError && error.aborted
  );
});

test("enforces one combined stdout and stderr budget", async () => {
  await assert.rejects(new SpawnCommandRunner().run(process.execPath,
    ["-e", "process.stdout.write('x'.repeat(80));process.stderr.write('x'.repeat(80))"],
    { timeoutMs: 10_000, maxOutputBytes: 128 }),
    error => error instanceof CommandExecutionError && error.resourceLimited);
});

test("terminates a processor whose generated PDF exceeds its disk budget", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "paragon-output-budget-"));
  const outputPath = path.join(directory, "output.pdf");
  try {
    await assert.rejects(new SpawnCommandRunner().run(process.execPath, ["-e",
      "require('node:fs').writeFileSync(process.argv[1], Buffer.alloc(4096));setInterval(()=>{},1000)", outputPath],
      { timeoutMs: 10_000, maxOutputBytes: 1024, outputFile: { path: outputPath, maxBytes: 128 } }),
      error => error instanceof CommandExecutionError && error.resourceLimited && error.message.includes("file limit"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
