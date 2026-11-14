import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { LocalStorageService } from "./local-storage.service";

test("local PDFs survive adapter recreation and immutable objects cannot be overwritten", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "paragon-persistence-"));
  const objectKey = "special-issues/1234/1234.pdf";
  const options = { contentType: "application/pdf", upsert: false };
  try {
    const first = new LocalStorageService(root);
    await first.upload(objectKey, Buffer.from("original"), options);
    const recreated = new LocalStorageService(root);
    await assert.rejects(recreated.upload(objectKey, Buffer.from("replacement"), options), { code: "EEXIST" });
    assert.equal((await readFile(path.join(root, objectKey))).toString(), "original");
    await assert.rejects(recreated.remove(["../outside.pdf"]), /Invalid storage path/);
    await recreated.remove([objectKey]);
    await assert.rejects(readFile(path.join(root, objectKey)), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});
