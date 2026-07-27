import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { StorageService } from "../../storage/storage.interface";
import type {
  PdfProcessor,
  ProcessedPdf,
} from "./pdf-processing/pdf.types";
import type { CreateMultipartIssueInput } from "./special-issue.schema";
import {
  createIssueWithDependencies,
  getPublishedIssues,
  replaceIssuePdfWithDependencies,
  type SpecialIssueCreateDependencies,
  type SpecialIssueReplacementDependencies,
} from "./special-issue.service";
import type { UploadedPdfFile } from "./special-issue-upload.middleware";

const issueInput: CreateMultipartIssueInput = {
  title: "Test Issue",
  slug: "test-issue",
  type: "Tabloid",
  academicYear: "2025-2026",
  description: "",
  coverImage: "https://example.com/cover.webp",
  publishedAt: "",
  status: "draft",
};

function uploadedFile(filePath: string): UploadedPdfFile {
  return {
    fieldname: "pdf",
    originalname: "../../issue.txt",
    encoding: "7bit",
    mimetype: "application/pdf",
    destination: path.dirname(filePath),
    filename: path.basename(filePath),
    path: filePath,
    size: 100,
  };
}

class FakeStorage implements StorageService {
  uploaded: string[] = [];
  removed: string[][] = [];
  failUpload = false;
  failRemove = false;

  async upload(): Promise<void> {}

  async uploadFile(objectKey: string): Promise<void> {
    this.uploaded.push(objectKey);
    if (this.failUpload) throw new Error("upload failed");
  }

  async remove(paths: string[]): Promise<void> {
    this.removed.push(paths);
    if (this.failRemove) throw new Error("remove failed");
  }

  getPublicUrl(objectKey: string): string {
    return `https://storage.example/${objectKey}`;
  }
}

function processed(filePath: string): ProcessedPdf {
  return {
    filePath,
    originalFilename: "issue.pdf",
    originalSizeBytes: 1_000,
    optimizedSizeBytes: 600,
    compressionPercent: 40,
    pageCount: 12,
    sha256: "a".repeat(64),
    processor: "fake",
    profile: "ebook",
    status: "optimized",
    durationMs: 25,
  };
}

function dependencies(
  filePath: string,
  storage: FakeStorage,
  create: SpecialIssueCreateDependencies["repository"]["create"]
): SpecialIssueCreateDependencies {
  const processor: PdfProcessor = {
    process: async () => processed(filePath),
    checkAvailability: async () => true,
  };
  return {
    processor,
    storage,
    repository: {
      create,
      enqueueStorageCleanup: async () => undefined,
    },
  };
}

test("uploads a processed PDF before creating its database record", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-service-test-")
  );
  const filePath = path.join(directory, "input.pdf");
  await writeFile(filePath, "pdf");
  const storage = new FakeStorage();
  let createdInput: Parameters<
    SpecialIssueCreateDependencies["repository"]["create"]
  >[0] | undefined;

  try {
    const result = await createIssueWithDependencies(
      issueInput,
      uploadedFile(filePath),
      dependencies(filePath, storage, async input => {
        createdInput = input;
        return {
          id: "issue-id",
          title: input.title,
          slug: input.slug,
          pdfUrl: input.pdfUrl,
        };
      })
    );

    assert.equal(result.id, "issue-id");
    assert.equal(storage.uploaded.length, 1);
    assert.match(storage.uploaded[0]!, /^special-issues\/[a-f0-9-]+\/[a-f0-9-]+\.pdf$/);
    assert.equal(createdInput?.pdfMetadata?.originalSizeBytes, 1_000);
    assert.equal(createdInput?.pdfMetadata?.optimizedSizeBytes, 600);
    assert.equal(createdInput?.pdfUrl, `https://storage.example/${storage.uploaded[0]}`);
    assert.deepEqual(storage.removed, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("removes the uploaded object when the database insert fails", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-service-test-")
  );
  const filePath = path.join(directory, "input.pdf");
  await writeFile(filePath, "pdf");
  const storage = new FakeStorage();

  try {
    await assert.rejects(
      createIssueWithDependencies(
        issueInput,
        uploadedFile(filePath),
        dependencies(filePath, storage, async () => {
          throw new Error("database failed");
        })
      ),
      /database failed/
    );
    assert.equal(storage.uploaded.length, 1);
    assert.deepEqual(storage.removed, [[storage.uploaded[0]!]]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("attempts cleanup after a failed storage upload", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-service-test-")
  );
  const filePath = path.join(directory, "input.pdf");
  await writeFile(filePath, "pdf");
  const storage = new FakeStorage();
  storage.failUpload = true;

  try {
    await assert.rejects(
      createIssueWithDependencies(
        issueInput,
        uploadedFile(filePath),
        dependencies(filePath, storage, async () => {
          throw new Error("repository should not be called");
        })
      ),
      /upload failed/
    );
    assert.equal(storage.removed.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function replacementDependencies(
  filePath: string,
  storage: FakeStorage,
  overrides: Partial<
    SpecialIssueReplacementDependencies["repository"]
  > = {}
): SpecialIssueReplacementDependencies {
  return {
    processor: {
      process: async () => processed(filePath),
      checkAvailability: async () => true,
    },
    storage,
    repository: {
      findPdfMutationState: async id => ({
        id,
        pdfUrl: "https://storage.example/special-issues/old.pdf",
        storagePath: "special-issues/old.pdf",
      }),
      replacePdf: async (id, _expected, pdfUrl) => ({ id, pdfUrl }),
      enqueueStorageCleanup: async () => undefined,
      ...overrides,
    },
  };
}

test("replaces the database pointer before deleting the old PDF", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-replacement-test-")
  );
  const filePath = path.join(directory, "input.pdf");
  await writeFile(filePath, "pdf");
  const storage = new FakeStorage();
  const events: string[] = [];
  storage.uploadFile = async objectKey => {
    storage.uploaded.push(objectKey);
    events.push("upload-new");
  };
  storage.remove = async paths => {
    storage.removed.push(paths);
    events.push(`remove:${paths[0]}`);
  };

  try {
    const result = await replaceIssuePdfWithDependencies(
      "issue-id",
      uploadedFile(filePath),
      replacementDependencies(filePath, storage, {
        replacePdf: async (id, _expected, pdfUrl) => {
          events.push("update-database");
          return { id, pdfUrl };
        },
      })
    );

    assert.equal(result.id, "issue-id");
    assert.deepEqual(events, [
      "upload-new",
      "update-database",
      "remove:special-issues/old.pdf",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("removes the new PDF when optimistic replacement conflicts", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-replacement-test-")
  );
  const filePath = path.join(directory, "input.pdf");
  await writeFile(filePath, "pdf");
  const storage = new FakeStorage();

  try {
    await assert.rejects(
      replaceIssuePdfWithDependencies(
        "issue-id",
        uploadedFile(filePath),
        replacementDependencies(filePath, storage, {
          replacePdf: async () => {
            throw Object.assign(new Error("replacement conflict"), {
              statusCode: 409,
            });
          },
        })
      ),
      /replacement conflict/
    );
    assert.equal(storage.uploaded.length, 1);
    assert.deepEqual(storage.removed, [[storage.uploaded[0]!]]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("queues cleanup when deleting the replaced PDF fails", async () => {
  const directory = await mkdtemp(
    path.join(os.tmpdir(), "paragon-replacement-test-")
  );
  const filePath = path.join(directory, "input.pdf");
  await writeFile(filePath, "pdf");
  const storage = new FakeStorage();
  storage.failRemove = true;
  const queued: Array<{ path: string; reason: string }> = [];

  try {
    const result = await replaceIssuePdfWithDependencies(
      "issue-id",
      uploadedFile(filePath),
      replacementDependencies(filePath, storage, {
        enqueueStorageCleanup: async (storagePath, reason) => {
          queued.push({ path: storagePath, reason });
        },
      })
    );

    assert.equal(result.id, "issue-id");
    assert.deepEqual(queued, [
      {
        path: "special-issues/old.pdf",
        reason: "special-issue-replacement",
      },
    ]);
    assert.equal(storage.removed.length, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("public list service rejects unpublished status filters", async () => {
  await assert.rejects(
    getPublishedIssues({
      page: 1,
      limit: 10,
      status: "draft",
      sortBy: "publishedAt",
      sortOrder: "desc",
    }),
    error =>
      error instanceof Error &&
      (error as Error & { statusCode?: number }).statusCode === 400
  );
});
