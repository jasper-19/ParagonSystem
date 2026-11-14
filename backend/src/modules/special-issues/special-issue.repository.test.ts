import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import db from "../../config/db";
import { findAdmin, update } from "./special-issue.repository";

afterEach(() => mock.restoreAll());
after(async () => db.end());

const query = { page: 1, limit: 10, sortBy: "publishedAt", sortOrder: "desc" } as const;

test("development PDF responses permit only the configured local storage URL path", async () => {
  const priorEnvironment = process.env.NODE_ENV;
  const priorLocalUrl = process.env.LOCAL_STORAGE_URL;
  process.env.NODE_ENV = "test";
  process.env.LOCAL_STORAGE_URL = "http://localhost:3000/uploads";
  const urls = [
    "http://localhost:3000/uploads/special-issues/a.pdf",
    "http://localhost:3000/uploads-evil/a.pdf",
    "http://attacker.example/uploads/a.pdf",
  ];
  mock.method(db, "query", async () => ({ rows: urls.map(pdf_url => ({
    id: "issue-id", pdf_url, cover_image: "https://example.com/cover.png",
  })) }));
  try {
    const result = await findAdmin(query);
    assert.deepEqual(result.items.map(item => item.pdfUrl), [urls[0], "", ""]);
    process.env.NODE_ENV = "production";
    const productionResult = await findAdmin(query);
    assert.deepEqual(productionResult.items.map(item => item.pdfUrl), ["", "", ""]);
  } finally {
    if (priorEnvironment === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = priorEnvironment;
    if (priorLocalUrl === undefined) delete process.env.LOCAL_STORAGE_URL;
    else process.env.LOCAL_STORAGE_URL = priorLocalUrl;
  }
});

test("publishing a draft assigns its first publication time without overwriting existing dates", async () => {
  let statement = "";
  mock.method(db, "query", async (sql: string) => {
    statement = sql;
    return { rows: [{ id: "issue-id" }] };
  });
  await update("issue-id", { status: "published" });
  assert.match(statement, /published_at = COALESCE\(published_at, NOW\(\)\)/);
  await update("issue-id", { status: "published", publishedAt: "2026-10-01" });
  assert.doesNotMatch(statement, /COALESCE/);
});

test("development media covers survive response mapping without becoming accepted PDF URLs", async () => {
  const keys = ["NODE_ENV", "API_BASE_URL", "LOCAL_STORAGE_URL"] as const;
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  process.env.NODE_ENV = "test";
  process.env.API_BASE_URL = "http://localhost:5000";
  process.env.LOCAL_STORAGE_URL = "http://localhost:3000/uploads";
  const coverImage = "http://localhost:5000/api/media/12345678-1234-1234-1234-123456789abc/file";
  mock.method(db, "query", async () => ({ rows: [{
    id: "issue-id", cover_image: coverImage, pdf_url: coverImage,
  }] }));
  try {
    const developmentResult = await findAdmin(query);
    assert.equal(developmentResult.items[0]?.coverImage, coverImage);
    assert.equal(developmentResult.items[0]?.pdfUrl, "");
    process.env.NODE_ENV = "production";
    const productionResult = await findAdmin(query);
    assert.equal(productionResult.items[0]?.coverImage, "");
    assert.equal(productionResult.items[0]?.pdfUrl, "");
  } finally {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
