import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { afterEach, mock, test } from "node:test";
import express from "express";
import { PdfProcessingError } from "../modules/special-issues/pdf-processing/pdf.types";
import { errorHandler } from "./errorHandler";

afterEach(() => mock.restoreAll());

const internalMessage = "spawn C:/private/native/gs.exe ENOENT secret-detail";

async function requestError(error: Error): Promise<{ status: number; body: Record<string, unknown> }> {
  mock.method(console, "error", () => undefined);
  const app = express();
  app.get("/upload", () => { throw error; });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/upload`);
    const body = await response.json() as Record<string, unknown>;
    const serialized = JSON.stringify(body);
    assert.doesNotMatch(serialized, /private|native|gs\.exe|ENOENT|secret-detail|stack|at requestError/i);
    return { status: response.status, body };
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

for (const code of ["PDF_PROCESSOR_UNAVAILABLE", "PDF_PROCESSOR_DISABLED"]) {
  test(`known ${code} exposes a safe actionable 503 response`, async () => {
    const response = await requestError(new PdfProcessingError(internalMessage, 503, code));
    assert.equal(response.status, 503);
    assert.deepEqual(Object.keys(response.body).sort(), ["code", "error"]);
    assert.equal(response.body.code, code);
    assert.equal(response.body.error,
      "PDF uploads are unavailable because the PDF processor is not configured. Please contact the administrator.");
  });
}

test("an unknown PDF processing failure retains the generic 503 response", async () => {
  const response = await requestError(new PdfProcessingError(internalMessage, 503, "PDF_UNKNOWN_INTERNAL_FAILURE"));
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Internal server error" });
});

test("an ordinary error cannot forge the trusted PDF error code or class name", async () => {
  const forged = Object.assign(new Error(internalMessage), {
    name: "PdfProcessingError", statusCode: 503, code: "PDF_PROCESSOR_UNAVAILABLE",
  });
  const response = await requestError(forged);
  assert.equal(response.status, 503);
  assert.deepEqual(response.body, { error: "Internal server error" });
});

test("an unexpected server error returns only the generic 500 response", async () => {
  const response = await requestError(new Error(internalMessage));
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "Internal server error" });
});

test("a recognized PDF code with a different server status remains generic", async () => {
  const response = await requestError(new PdfProcessingError(internalMessage, 500, "PDF_PROCESSOR_UNAVAILABLE"));
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: "Internal server error" });
});

test("malformed JSON details stay out of responses and logs", async () => {
  const response = await requestError(Object.assign(new SyntaxError(internalMessage), {
    status: 400, type: "entity.parse.failed",
  }));
  assert.deepEqual(response, { status: 400, body: { error: "Invalid JSON request body" } });
  const calls = (console.error as typeof console.error & { mock: { calls: { arguments: unknown[] }[] } }).mock.calls;
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(calls[0]?.arguments), /secret-detail/);
});
