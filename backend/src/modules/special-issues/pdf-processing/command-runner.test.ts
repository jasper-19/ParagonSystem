import assert from "node:assert/strict";
import test from "node:test";
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
