import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { request as httpRequest } from "node:http";
import test from "node:test";
import express, { type Express } from "express";
import { errorHandler } from "../../middlewares/errorHandler";
import { signAuthToken } from "../../security/auth-token";
import specialIssueRouter from "./special-issue.routes";
import {
  parseSpecialIssuePdfUpload,
  createUploadAdmission,
  createSpecialIssuePdfUploadParser,
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

test('operational migration pause denies every admin mutation before parsing or database work', async () => {
  const original = process.env.SPECIAL_ISSUE_MUTATIONS_PAUSED;
  process.env.SPECIAL_ISSUE_MUTATIONS_PAUSED = 'true';
  const app = express(); app.use('/special-issues', specialIssueRouter); app.use(errorHandler);
  const token = signAuthToken({ subject: 'env-admin', role: 'admin' });
  try {
    await withServer(app, async baseUrl => {
      for (const [method, path] of [['POST', ''], ['PATCH', '/11111111-1111-4111-8111-111111111111'],
        ['PATCH', '/11111111-1111-4111-8111-111111111111/pdf'],
        ['PATCH', '/11111111-1111-4111-8111-111111111111/status'],
        ['DELETE', '/11111111-1111-4111-8111-111111111111']]) {
        const response = await fetch(`${baseUrl}/special-issues${path}`, { method: method!,
          headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('retry-after'), '120');
      }
      assert.equal((await fetch(`${baseUrl}/special-issues`, {method:'POST'})).status,401);
    });
  } finally {
    if (original === undefined) delete process.env.SPECIAL_ISSUE_MUTATIONS_PAUSED;
    else process.env.SPECIAL_ISSUE_MUTATIONS_PAUSED = original;
  }
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

test("multipart create accepts a cover selected from the configured development media API", async () => {
  const previousEnvironment = process.env.NODE_ENV;
  const previousBase = process.env.API_BASE_URL;
  process.env.NODE_ENV = "development";
  process.env.API_BASE_URL = "http://localhost:5000";
  const coverImage = "http://localhost:5000/api/media/11111111-1111-4111-8111-111111111111/file";
  const app = express();
  app.post("/upload", parseSpecialIssuePdfUpload, validateSpecialIssueCreateRequest,
    (req, res) => res.status(201).json({ coverImage: req.body.coverImage }));
  app.use(errorHandler);
  try {
    await withServer(app, async baseUrl => {
      const form = validMultipartPdf();
      form.set("coverImage", coverImage);
      const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
      const body = await response.json() as { coverImage?: string };
      assert.equal(response.status, 201, JSON.stringify(body));
      assert.equal(body.coverImage, coverImage);
    });
  } finally {
    if (previousEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnvironment;
    if (previousBase === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previousBase;
  }
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

test("multipart uploads reject non-PDF extensions even with a PDF MIME type", async () => {
  const app = express();
  app.post("/upload", parseSpecialIssuePdfUpload, (_req, res) => res.sendStatus(201));
  app.use(errorHandler);
  const form = validMultipartPdf();
  form.set("pdf", new Blob(["%PDF-1.7\n%%EOF"], { type: "application/pdf" }), "issue.exe");
  await withServer(app, async baseUrl => {
    const response = await fetch(`${baseUrl}/upload`, { method: "POST", body: form });
    assert.equal(response.status, 415);
  });
});

test("upload admission rejects excess work and releases capacity on response completion", async () => {
  const app = express();
  let finish: (() => void) | undefined;
  app.post("/upload", createUploadAdmission(1), (_req, res) => { finish = () => res.sendStatus(201); });
  await withServer(app, async baseUrl => {
    const first = fetch(`${baseUrl}/upload`, { method: "POST" });
    for (let attempt = 0; attempt < 100 && !finish; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(finish);
    const busy = await fetch(`${baseUrl}/upload`, { method: "POST" });
    assert.equal(busy.status, 429);
    assert.equal(busy.headers.get("retry-after"), "10");
    finish();
    assert.equal((await first).status, 201);
    finish = undefined;
    const retry = fetch(`${baseUrl}/upload`, { method: "POST" });
    for (let attempt = 0; attempt < 100 && !finish; attempt++) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(finish);
    (finish as () => void)();
    assert.equal((await retry).status, 201);
  });
});

test("stalled multipart requests receive a complete 408 before the socket closes", async () => {
  const app = express();
  app.post("/upload", createSpecialIssuePdfUploadParser(30), (_req, res) => res.sendStatus(201));
  app.use(errorHandler);
  await withServer(app, async baseUrl => {
    const response = await new Promise<{ status: number | undefined; body: string }>((resolve, reject) => {
      const req = httpRequest(`${baseUrl}/upload`, { method: "POST", headers: {
        "Content-Type": "multipart/form-data; boundary=slow-upload", "Transfer-Encoding": "chunked",
      } }, res => {
        let body = "";
        res.on("data", chunk => { body += chunk.toString(); });
        res.on("end", () => resolve({ status: res.statusCode, body }));
        res.on("error", reject);
      });
      req.on("error", reject);
      req.write('--slow-upload\r\nContent-Disposition: form-data; name="pdf"; filename="issue.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7\n');
      // Deliberately leave the upload incomplete until the server times it out.
    });
    assert.equal(response.status, 408);
    assert.match(JSON.parse(response.body).error, /timed out/);
  });
});
