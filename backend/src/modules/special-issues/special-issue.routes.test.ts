import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import test from "node:test";
import express, { type Express } from "express";
import { errorHandler } from "../../middlewares/errorHandler";
import { signAuthToken } from "../../security/auth-token";
import specialIssueRouter from "./special-issue.routes";
import {
  parseSpecialIssuePdfUpload,
  type PdfUploadRequest,
  validateSpecialIssueCreateRequest,
} from "./special-issue-upload.middleware";

process.env.JWT_SECRET ??= "stage-3-test-secret-at-least-32-bytes-long";

async function withServer(
  app: Express,
  run: (baseUrl: string) => Promise<void>
): Promise<void> {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const address = server.address() as AddressInfo;

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close(error => (error ? reject(error) : resolve()));
    });
  }
}

function validMultipartPdf(): FormData {
  const form = new FormData();
  form.set("title", "Integration Issue");
  form.set("slug", "integration-issue");
  form.set("type", "Newsletter");
  form.set("academicYear", "2025-2026");
  form.set("description", "Route integration test");
  form.set("coverImage", "https://example.com/cover.webp");
  form.set("status", "draft");
  form.set(
    "pdf",
    new Blob(["%PDF-1.7\n%%EOF"], { type: "application/pdf" }),
    "../../unsafe-name.pdf"
  );
  return form;
}

test("admin Special Issue routes reject unauthenticated requests before work", async () => {
  const app = express();
  app.use("/special-issues", specialIssueRouter);
  app.use(errorHandler);

  await withServer(app, async baseUrl => {
    const adminRead = await fetch(`${baseUrl}/special-issues/admin`);
    assert.equal(adminRead.status, 401);

    const upload = await fetch(`${baseUrl}/special-issues`, {
      method: "POST",
      body: validMultipartPdf(),
    });
    assert.equal(upload.status, 401);

    const replacement = await fetch(
      `${baseUrl}/special-issues/11111111-1111-4111-8111-111111111111/pdf`,
      {
        method: "PATCH",
        body: validMultipartPdf(),
      }
    );
    assert.equal(replacement.status, 401);

    const deletion = await fetch(
      `${baseUrl}/special-issues/11111111-1111-4111-8111-111111111111`,
      { method: "DELETE" }
    );
    assert.equal(deletion.status, 401);
  });
});

test("authenticated non-admin users cannot access admin Special Issue routes", async () => {
  const app = express();
  app.use("/special-issues", specialIssueRouter);
  app.use(errorHandler);
  const token = signAuthToken({
    subject: "env-admin",
    role: "staff",
  });

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/special-issues/admin`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 403);
  });
});

test("multipart middleware writes a UUID file and removes it after response", async () => {
  const app = express();
  let uploadedPath: string | undefined;
  app.post(
    "/upload",
    parseSpecialIssuePdfUpload,
    validateSpecialIssueCreateRequest,
    (req, res) => {
      const uploadRequest = req as PdfUploadRequest;
      uploadedPath = uploadRequest.file?.path;
      res.status(201).json({
        title: req.body.title,
        filename: uploadRequest.file?.filename,
        originalname: uploadRequest.file?.originalname,
      });
    }
  );
  app.use(errorHandler);

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: validMultipartPdf(),
    });
    assert.equal(response.status, 201);
    const body = await response.json() as Record<string, unknown>;
    assert.equal(body["title"], "Integration Issue");
    assert.match(String(body["filename"]), /^[a-f0-9-]+\.pdf$/);
    assert.equal(body["originalname"], "unsafe-name.pdf");
    assert.ok(uploadedPath);

    await new Promise(resolve => setTimeout(resolve, 20));
    await assert.rejects(access(uploadedPath!), { code: "ENOENT" });
  });
});

test("multipart middleware rejects a spoofed declared MIME type", async () => {
  const app = express();
  app.post(
    "/upload",
    parseSpecialIssuePdfUpload,
    validateSpecialIssueCreateRequest,
    (_req, res) => res.status(201).end()
  );
  app.use(errorHandler);
  const form = validMultipartPdf();
  form.set(
    "pdf",
    new Blob(["%PDF-1.7\n%%EOF"], { type: "text/plain" }),
    "spoofed.pdf"
  );

  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: form,
    });
    assert.equal(response.status, 415);
    assert.deepEqual(await response.json(), {
      error: "Only PDF uploads are accepted",
    });
  });
});
