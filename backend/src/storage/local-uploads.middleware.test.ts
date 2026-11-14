import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { get } from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import express from "express";
import { localUploadsMiddleware } from "./local-uploads.middleware";

test("PDF delivery supports exact byte ranges, cache validation and unsatisfiable ranges", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paragon-range-"));
  const directory = path.join(root, "special-issues", "1234");
  await mkdir(directory, { recursive: true });
  const bytes = Buffer.from("%PDF-1.7\nrange-test-data\n%%EOF");
  await writeFile(path.join(directory, "1234.pdf"), bytes);
  const app = express();
  app.use("/uploads", localUploadsMiddleware(root));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/uploads/special-issues/1234/1234.pdf`;
  try {
    const full = await fetch(url);
    assert.equal(full.status, 200);
    assert.match(full.headers.get("content-type")!, /application\/pdf/);
    assert.equal(full.headers.get("content-disposition"), "inline");
    assert.match(full.headers.get("cache-control")!, /immutable/);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), bytes);
    const partial = await fetch(url, { headers: { Range: "bytes=0-7" } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get("content-range"), `bytes 0-7/${bytes.length}`);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), bytes.subarray(0, 8));
    // Fetch adds cache-control:no-cache to conditional requests in Node, which
    // correctly forces revalidation as a full response. Exercise raw HTTP here.
    const cachedStatus = await new Promise<number | undefined>((resolve, reject) => {
      get(url, { headers: { "If-None-Match": full.headers.get("etag")! } }, response => {
        response.resume(); response.once("end", () => resolve(response.statusCode));
      }).once("error", reject);
    });
    assert.equal(cachedStatus, 304);
    const invalid = await fetch(url, { headers: { Range: "bytes=999999-" } });
    assert.equal(invalid.status, 416);
    await invalid.arrayBuffer();
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
