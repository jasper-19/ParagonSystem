import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";

export type CommandRunOptions = {
  timeoutMs: number;
  maxOutputBytes: number;
  signal?: AbortSignal;
};

export type CommandResult = {
  stdout: string;
  stderr: string;
  durationMs: number;
};

export interface CommandRunner {
  run(
    executable: string,
    args: readonly string[],
    options: CommandRunOptions
  ): Promise<CommandResult>;
}

export class CommandExecutionError extends Error {
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly aborted: boolean;

  constructor(
    message: string,
    details: {
      exitCode: number | null;
      timedOut: boolean;
      aborted: boolean;
    }
  ) {
    super(message);
    this.name = "CommandExecutionError";
    this.exitCode = details.exitCode;
    this.timedOut = details.timedOut;
    this.aborted = details.aborted;
  }
}

export class SpawnCommandRunner implements CommandRunner {
  run(
    executable: string,
    args: readonly string[],
    options: CommandRunOptions
  ): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const startedAt = performance.now();
      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;
      let aborted = false;
      let settled = false;

      const child = spawn(executable, [...args], {
        shell: false,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stop = (): void => {
        if (!child.killed) child.kill("SIGKILL");
      };

      const timeout = setTimeout(() => {
        timedOut = true;
        stop();
      }, options.timeoutMs);
      timeout.unref();

      const onAbort = (): void => {
        aborted = true;
        stop();
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });

      const appendOutput = (
        chunks: Buffer[],
        currentBytes: number,
        chunk: Buffer
      ): number | null => {
        const nextBytes = currentBytes + chunk.length;
        if (nextBytes > options.maxOutputBytes) {
          stop();
          return null;
        }
        chunks.push(chunk);
        return nextBytes;
      };

      child.stdout.on("data", (chunk: Buffer) => {
        const next = appendOutput(stdoutChunks, stdoutBytes, chunk);
        if (next === null) {
          if (!settled) {
            settled = true;
            reject(
              new CommandExecutionError("PDF processor output limit exceeded", {
                exitCode: null,
                timedOut: false,
                aborted: false,
              })
            );
          }
          return;
        }
        stdoutBytes = next;
      });

      child.stderr.on("data", (chunk: Buffer) => {
        const next = appendOutput(stderrChunks, stderrBytes, chunk);
        if (next === null) {
          if (!settled) {
            settled = true;
            reject(
              new CommandExecutionError("PDF processor output limit exceeded", {
                exitCode: null,
                timedOut: false,
                aborted: false,
              })
            );
          }
          return;
        }
        stderrBytes = next;
      });

      child.once("error", error => {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", onAbort);
        if (settled) return;
        settled = true;
        reject(
          new CommandExecutionError(
            error instanceof Error
              ? error.message
              : "PDF processor could not be started",
            {
              exitCode: null,
              timedOut,
              aborted,
            }
          )
        );
      });

      child.once("close", exitCode => {
        clearTimeout(timeout);
        options.signal?.removeEventListener("abort", onAbort);
        if (settled) return;
        settled = true;

        if (exitCode !== 0 || timedOut || aborted) {
          reject(
            new CommandExecutionError(
              timedOut
                ? "PDF processing timed out"
                : aborted
                  ? "PDF processing was cancelled"
                  : "PDF processor rejected the document",
              { exitCode, timedOut, aborted }
            )
          );
          return;
        }

        resolve({
          stdout: Buffer.concat(stdoutChunks, stdoutBytes).toString("utf8"),
          stderr: Buffer.concat(stderrChunks, stderrBytes).toString("utf8"),
          durationMs: performance.now() - startedAt,
        });
      });
    });
  }
}
