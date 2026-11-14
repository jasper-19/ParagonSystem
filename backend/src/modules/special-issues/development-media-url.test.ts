import assert from "node:assert/strict";
import test from "node:test";
import { isDevelopmentMediaFileUrl } from "./development-media-url";
import {
  createIssueSchema,
  createMultipartIssueSchema,
  updateIssueSchema,
} from "./special-issue.schema";

const mediaPath = "/api/media/12345678-1234-1234-1234-123456789abc/file";
const localCover = `http://localhost:5000${mediaPath}`;
const issue = {
  title: "Campus publication",
  slug: "campus-publication",
  type: "Newsletter",
  academicYear: "2026-2027",
  status: "draft",
  coverImage: localCover,
  pdfUrl: "https://example.com/publication.pdf",
};

function withEnvironment(values: Record<string, string | undefined>, run: () => void): void {
  const original = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    run();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("create, multipart create and update accept the configured development media cover", () => {
  withEnvironment({ NODE_ENV: "test", API_BASE_URL: "http://localhost:5000" }, () => {
    assert.equal(isDevelopmentMediaFileUrl(localCover), true);
    assert.equal(createIssueSchema.safeParse(issue).success, true);
    assert.equal(createMultipartIssueSchema.safeParse(issue).success, true);
    assert.equal(updateIssueSchema.safeParse({ coverImage: localCover }).success, true);
    assert.equal(createIssueSchema.safeParse({ ...issue, pdfUrl: localCover }).success, false);
  });
});

test("production rejects HTTP media covers while retaining HTTPS and supported data URLs", () => {
  withEnvironment({ NODE_ENV: "production", API_BASE_URL: "http://localhost:5000" }, () => {
    assert.equal(isDevelopmentMediaFileUrl(localCover), false);
    assert.equal(createIssueSchema.safeParse(issue).success, false);
    assert.equal(createMultipartIssueSchema.safeParse(issue).success, false);
    assert.equal(updateIssueSchema.safeParse({ coverImage: localCover }).success, false);
    for (const coverImage of ["https://example.com/cover.jpg", "data:image/png;base64,aGVsbG8="]) {
      assert.equal(createIssueSchema.safeParse({ ...issue, coverImage }).success, true);
    }
  });
});

test("development media exception rejects hostile origins, credentials, paths and encoded variants", () => {
  withEnvironment({ NODE_ENV: "test", API_BASE_URL: "http://localhost:5000" }, () => {
    const invalid = [
      `http://localhost:5001${mediaPath}`,
      `http://localhost.attacker.example:5000${mediaPath}`,
      `http://127.0.0.1:5000${mediaPath}`,
      `http://user:password@localhost:5000${mediaPath}`,
      `http://attacker.example${mediaPath}`,
      `${localCover}?download=1`,
      `${localCover}#fragment`,
      `${localCover}/extra`,
      localCover.replace("/api/media/", "/api/media-evil/"),
      localCover.replace("/api/media/", "/api/evil/../media/"),
      localCover.replace("/api/media/", "/api/%2e/media/"),
      localCover.replace("/api/media/", "/api%2fmedia/"),
      localCover.replace("/api/media/", "/api%5cmedia/"),
      localCover.replace("/file", "/%66ile"),
      localCover.replace("/file", "/file%252fextra"),
      localCover.replace("/api/media/", "/api\\media/"),
      "javascript:alert(1)",
      "data:text/html;base64,aGVsbG8=",
    ];
    for (const coverImage of invalid) {
      assert.equal(isDevelopmentMediaFileUrl(coverImage), false, coverImage);
      assert.equal(createMultipartIssueSchema.safeParse({ ...issue, coverImage }).success, false, coverImage);
      assert.equal(updateIssueSchema.safeParse({ coverImage }).success, false, coverImage);
    }
  });
});

test("development media URLs follow custom API_BASE_URL path and explicit origin", () => {
  withEnvironment({ NODE_ENV: "test", API_BASE_URL: "http://127.0.0.1:8123/paragon/", PORT: "9000" }, () => {
    const coverImage = `http://127.0.0.1:8123/paragon${mediaPath}`;
    assert.equal(isDevelopmentMediaFileUrl(coverImage), true);
    assert.equal(createMultipartIssueSchema.safeParse({ ...issue, coverImage }).success, true);
    assert.equal(isDevelopmentMediaFileUrl(`http://127.0.0.1:8123${mediaPath}`), false);
    assert.equal(isDevelopmentMediaFileUrl(`http://localhost:9000/paragon${mediaPath}`), false);
  });
});

test("development media URLs use PORT and the 5000 default when API_BASE_URL is absent", () => {
  withEnvironment({ NODE_ENV: "test", API_BASE_URL: undefined, PORT: "8123" }, () => {
    assert.equal(isDevelopmentMediaFileUrl(`http://localhost:8123${mediaPath}`), true);
    assert.equal(isDevelopmentMediaFileUrl(localCover), false);
  });
  withEnvironment({ NODE_ENV: "test", API_BASE_URL: undefined, PORT: undefined }, () => {
    assert.equal(isDevelopmentMediaFileUrl(localCover), true);
  });
});
