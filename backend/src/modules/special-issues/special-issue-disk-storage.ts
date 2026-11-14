import { randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Request } from "express";

type DiskFile = { stream: Readable; path?: string };
type DiskInfo = { destination: string; filename: string; path: string; size: number };

/** Multer storage that closes file handles before deleting interrupted writes. */
export function createSpecialIssueDiskStorage(root: string) {
  const pending = new Map<string, { abort: () => void; completion: Promise<DiskInfo> }>();
  return {
    _handleFile(req: Request, file: DiskFile, callback: (error: Error | null, info?: DiskInfo) => void): void {
      const cancellation = new AbortController();
      const abort = (): void => cancellation.abort();
      req.once("aborted", abort);
      if (req.aborted) abort();
      const filename = `${randomUUID()}.pdf`;
      const filePath = path.join(root, filename);
      const completion = (async () => {
        await mkdir(root, { recursive: true });
        if (cancellation.signal.aborted || file.stream.destroyed) throw new Error("PDF upload was interrupted");
        file.path = filePath;
        const output = createWriteStream(filePath, { flags: "wx", mode: 0o600 });
        await pipeline(file.stream, output, { signal: cancellation.signal });
        return { destination: root, filename, path: filePath, size: output.bytesWritten };
      })();
      pending.set(filePath, { abort, completion });
      void completion.then(info => callback(null, info), async error => {
        // pipeline waits for the writable to close, including on Windows.
        await unlink(filePath).catch(() => undefined);
        callback(error instanceof Error ? error : new Error("PDF upload failed"));
      }).finally(() => {
        pending.delete(filePath);
        req.removeListener("aborted", abort);
      });
    },
    _removeFile(_req: Request, file: DiskFile, callback: (error: Error | null) => void): void {
      if (!file.path) { callback(null); return; }
      const filePath = file.path;
      const writing = pending.get(filePath);
      writing?.abort();
      void (async () => {
        await writing?.completion.catch(() => undefined);
        await unlink(filePath).catch(error => {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        });
      })().then(() => callback(null), error => callback(error));
    },
  };
}
