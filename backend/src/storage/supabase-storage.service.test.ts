import assert from "node:assert/strict";
import { ReadStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

process.env.SUPABASE_URL = "https://storage.example.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
const { SupabaseStorageService } = require("./supabase-storage.service") as
  typeof import("./supabase-storage.service");

test("file uploads stream bytes and close the stream on success or storage failure", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "paragon-storage-test-"));
  const filePath = path.join(directory, "issue.pdf");
  const bytes = Buffer.from("%PDF-1.7\nstreamed bytes\n%%EOF");
  await writeFile(filePath, bytes);
  try {
    for (const failure of [false, true]) {
      let stream: ReadStream | undefined;
      const client = {
        storage: {
          from: (bucket: string) => ({
            upload: async (objectKey: string, body: ReadStream, options: Record<string, unknown>) => {
              assert.equal(bucket, "test-bucket");
              assert.equal(objectKey, "special-issues/test.pdf");
              assert.equal(options["upsert"], false);
              assert.ok(body instanceof ReadStream);
              stream = body;
              if (failure) return { error: new Error("storage unavailable") };
              const chunks: Buffer[] = [];
              for await (const chunk of body) chunks.push(chunk as Buffer);
              assert.deepEqual(Buffer.concat(chunks), bytes);
              return { error: null };
            },
          }),
        },
      } as unknown as ConstructorParameters<typeof SupabaseStorageService>[0];
      const service = new SupabaseStorageService(client, "test-bucket");
      const operation = service.uploadFile("special-issues/test.pdf", filePath, {
        contentType: "application/pdf", upsert: false,
      });
      if (failure) await assert.rejects(operation, /Storage upload failed/);
      else await operation;
      assert.equal(stream?.destroyed, true);
      assert.equal(stream?.closed, true);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
