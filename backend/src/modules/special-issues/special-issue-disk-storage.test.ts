import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import type { Request } from "express";
import { createSpecialIssueDiskStorage } from "./special-issue-disk-storage";

test("disk storage finishes files and closes interrupted writes before cleanup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paragon-disk-upload-"));
  try {
    const storage = createSpecialIssueDiskStorage(root);
    for (const interrupted of [false, true]) {
      const req = new EventEmitter() as Request;
      const stream = new PassThrough();
      const file = { stream };
      const completed = new Promise<{ path: string; size: number }>((resolve, reject) => {
        storage._handleFile(req, file, (error, info) => error ? reject(error) : resolve(info!));
      });
      stream.write("%PDF-1.7\n");
      if (interrupted) {
        // Wait until the file is open, reproducing the Windows unlink race.
        for (let attempt = 0; attempt < 100 && !(file as { path?: string }).path; attempt++) {
          await new Promise(resolve => setTimeout(resolve, 5));
        }
        req.emit("aborted");
        await assert.rejects(completed);
        assert.equal(stream.destroyed, true);
        assert.deepEqual(await readdir(root), []);
      } else {
        stream.end("%%EOF");
        const info = await completed;
        assert.equal((await readFile(info.path)).toString(), "%PDF-1.7\n%%EOF");
        assert.equal(info.size, 14);
        await new Promise<void>((resolve, reject) => storage._removeFile(req, { stream, path: info.path }, error => error ? reject(error) : resolve()));
        assert.deepEqual(await readdir(root), []);
      }
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
