import { randomUUID } from "node:crypto";
import { unlink } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import * as repository from "./special-issue.repository";
import {
  ISSUE_STATUS_VALUES,
  ISSUE_TYPE_VALUES,
  type CreateIssueInput,
  type CreateMultipartIssueInput,
  type IssueStatus,
  type IssueType,
  type SpecialIssueListQuery,
} from "./special-issue.schema";
import {
  type UploadedPdfFile,
} from "./special-issue-upload.middleware";
import { storageService } from "../../storage/storage.factory";
import type { StorageService } from "../../storage/storage.interface";
import { pdfProcessor } from "./pdf-processing/ghostscript-pdf.processor";
import type {
  PdfProcessor,
  ProcessedPdf,
} from "./pdf-processing/pdf.types";

export type SpecialIssueCreateDependencies = {
  repository: {
    create(
      data: repository.CreateSpecialIssueRecord
    ): Promise<{
      id: string;
      title?: unknown;
      slug?: unknown;
      type?: unknown;
      [key: string]: unknown;
    }>;
    enqueueStorageCleanup(
      storagePath: string,
      reason: string,
      errorMessage: string
    ): Promise<void>;
  };
  storage: StorageService;
  processor: PdfProcessor;
};

const defaultCreateDependencies: SpecialIssueCreateDependencies = {
  repository,
  storage: storageService,
  processor: pdfProcessor,
};

function logPdfEvent(
  event: string,
  context: Record<string, string | number | boolean>
): void {
  console.info(
    JSON.stringify({
      event,
      ...context,
    })
  );
}

export async function getPublishedIssues(query: SpecialIssueListQuery) {
  if (query.status && query.status !== "published") {
    throw Object.assign(
      new Error("Public issue listings only support published content"),
      { statusCode: 400 }
    );
  }
  return repository.findPublished(query);
}

export async function getAdminIssues(query: SpecialIssueListQuery) {
  return repository.findAdmin(query);
}

export async function getPublishedIssueBySlug(slug: string) {
  return repository.findBySlug(slug, false);
}

export async function getAdminIssueBySlug(slug: string) {
  return repository.findBySlug(slug, true);
}

export async function getIssuesByType(
  type: string,
  query: SpecialIssueListQuery
) {
  if (!ISSUE_TYPE_VALUES.includes(type as IssueType)) {
    throw Object.assign(new Error("Invalid Special Issue type"), {
      statusCode: 400,
    });
  }
  return repository.findPublished({
    ...query,
    type: type as IssueType,
  });
}

export async function createIssue(
  data: CreateIssueInput | CreateMultipartIssueInput,
  file?: UploadedPdfFile,
  signal?: AbortSignal
) {
  return createIssueWithDependencies(
    data,
    file,
    defaultCreateDependencies,
    signal
  );
}

export async function createIssueWithDependencies(
  data: CreateIssueInput | CreateMultipartIssueInput,
  file: UploadedPdfFile | undefined,
  dependencies: SpecialIssueCreateDependencies,
  signal?: AbortSignal
) {
  if (!file) {
    return dependencies.repository.create(data as CreateIssueInput);
  }

  if (
    file.mimetype.toLowerCase() !== "application/pdf" ||
    file.size <= 0
  ) {
    throw Object.assign(new Error("Invalid PDF upload"), {
      statusCode: 400,
    });
  }

  const startedAt = performance.now();
  let processed: ProcessedPdf;
  try {
    processed = await dependencies.processor.process(
      file.path,
      file.originalname,
      signal ? { signal } : undefined
    );
  } catch (error) {
    await unlink(file.path).catch(() => undefined);
    throw error;
  }
  const uploadId = randomUUID();
  const objectKey = `special-issues/${uploadId}/${uploadId}.pdf`;
  let uploadAttempted = false;
  let uploadDurationMs = 0;

  try {
    if (signal?.aborted) {
      throw Object.assign(new Error("Request was cancelled"), {
        statusCode: 499,
      });
    }

    uploadAttempted = true;
    const uploadStartedAt = performance.now();
    await dependencies.storage.uploadFile(
      objectKey,
      processed.filePath,
      {
        contentType: "application/pdf",
        cacheControl: "31536000",
        upsert: false,
      }
    );
    uploadDurationMs = performance.now() - uploadStartedAt;

    const pdfUrl = dependencies.storage.getPublicUrl(objectKey);
    const created = await dependencies.repository.create({
      ...data,
      pdfUrl,
      pdfMetadata: {
        storagePath: objectKey,
        originalFilename: processed.originalFilename,
        mimeType: "application/pdf",
        originalSizeBytes: processed.originalSizeBytes,
        optimizedSizeBytes: processed.optimizedSizeBytes,
        compressionPercent: processed.compressionPercent,
        pageCount: processed.pageCount,
        sha256: processed.sha256,
        compressionProfile: processed.profile,
        processor: processed.processor,
      },
    });

    logPdfEvent("special_issue_pdf_created", {
      issueId: String(created.id),
      originalSizeBytes: processed.originalSizeBytes,
      optimizedSizeBytes: processed.optimizedSizeBytes,
      compressionPercent: processed.compressionPercent,
      pageCount: processed.pageCount,
      processingDurationMs: Number(processed.durationMs.toFixed(2)),
      uploadDurationMs: Number(uploadDurationMs.toFixed(2)),
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
      usedOptimizedPdf: processed.status === "optimized",
    });

    return created;
  } catch (error) {
    if (uploadAttempted) {
      try {
        await dependencies.storage.remove([objectKey]);
      } catch (cleanupError) {
        logPdfEvent("special_issue_pdf_compensation_failed", {
          objectKey,
          message:
            cleanupError instanceof Error
              ? cleanupError.message
              : "Unknown cleanup error",
        });
        await dependencies.repository
          .enqueueStorageCleanup(
            objectKey,
            "create-compensation",
            cleanupError instanceof Error
              ? cleanupError.message
              : "Unknown cleanup error"
          )
          .catch(queueError => {
            logPdfEvent("special_issue_pdf_cleanup_queue_failed", {
              objectKey,
              message:
                queueError instanceof Error
                  ? queueError.message
                  : "Unknown cleanup queue error",
            });
          });
      }
    }
    throw error;
  } finally {
    if (
      processed.temporaryOutputPath &&
      processed.temporaryOutputPath !== file.path
    ) {
      await unlink(processed.temporaryOutputPath).catch(cleanupError => {
        logPdfEvent("special_issue_pdf_output_cleanup_failed", {
          message:
            cleanupError instanceof Error
              ? cleanupError.message
              : "Unknown cleanup error",
        });
      });
    }
    await unlink(file.path).catch(cleanupError => {
      if ((cleanupError as NodeJS.ErrnoException).code !== "ENOENT") {
        logPdfEvent("special_issue_pdf_input_cleanup_failed", {
          message:
            cleanupError instanceof Error
              ? cleanupError.message
              : "Unknown cleanup error",
        });
      }
    });
  }
}

export async function updateIssue(id: string, data: unknown) {
  return repository.update(id, data);
}

export async function deleteIssue(id: string) {
  const removed = await repository.removeArchived(id);
  if (removed.state === "not-found") {
    throw Object.assign(new Error("Issue not found"), { statusCode: 404 });
  }
  if (removed.state === "not-archived") {
    throw Object.assign(
      new Error("Only archived Special Issues can be deleted"),
      { statusCode: 409 }
    );
  }

  if (removed.storagePath) {
    try {
      await storageService.remove([removed.storagePath]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown cleanup error";
      await repository
        .enqueueStorageCleanup(
          removed.storagePath,
          "special-issue-delete",
          message
        )
        .catch(queueError => {
          logPdfEvent("special_issue_pdf_cleanup_queue_failed", {
            objectKey: removed.storagePath!,
            message:
              queueError instanceof Error
                ? queueError.message
                : "Unknown cleanup queue error",
          });
        });
    }
  }
}

export async function updateIssueStatus(id: string, status: string) {
  if (!ISSUE_STATUS_VALUES.includes(status as IssueStatus)) {
    throw Object.assign(new Error(`Invalid status: ${status}`), { statusCode: 400 });
  }

  return repository.update(id, { status });
}

export type SpecialIssueReplacementDependencies = {
  repository: {
    findPdfMutationState(
      id: string
    ): Promise<repository.PdfMutationState | null>;
    replacePdf(
      id: string,
      expected: repository.PdfMutationState,
      pdfUrl: string,
      metadata: repository.PdfStorageMetadata
    ): Promise<Record<string, unknown> & { id: string }>;
    enqueueStorageCleanup(
      storagePath: string,
      reason: string,
      errorMessage: string
    ): Promise<void>;
  };
  storage: StorageService;
  processor: PdfProcessor;
};

const defaultReplacementDependencies: SpecialIssueReplacementDependencies = {
  repository,
  storage: storageService,
  processor: pdfProcessor,
};

export async function replaceIssuePdf(
  id: string,
  file: UploadedPdfFile | undefined,
  signal?: AbortSignal
) {
  return replaceIssuePdfWithDependencies(
    id,
    file,
    defaultReplacementDependencies,
    signal
  );
}

export async function replaceIssuePdfWithDependencies(
  id: string,
  file: UploadedPdfFile | undefined,
  dependencies: SpecialIssueReplacementDependencies,
  signal?: AbortSignal
) {
  if (!file) {
    throw Object.assign(new Error("A PDF file is required"), {
      statusCode: 400,
    });
  }
  if (
    file.mimetype.toLowerCase() !== "application/pdf" ||
    file.size <= 0
  ) {
    throw Object.assign(new Error("Invalid PDF upload"), {
      statusCode: 400,
    });
  }

  const current = await dependencies.repository.findPdfMutationState(id);
  if (!current) {
    throw Object.assign(new Error("Issue not found"), { statusCode: 404 });
  }

  const startedAt = performance.now();
  let processed: ProcessedPdf;
  try {
    processed = await dependencies.processor.process(
      file.path,
      file.originalname,
      signal ? { signal } : undefined
    );
  } catch (error) {
    await unlink(file.path).catch(() => undefined);
    throw error;
  }

  const uploadId = randomUUID();
  const objectKey = `special-issues/${uploadId}/${uploadId}.pdf`;
  let uploadAttempted = false;
  let databaseUpdated = false;

  try {
    if (signal?.aborted) {
      throw Object.assign(new Error("Request was cancelled"), {
        statusCode: 499,
      });
    }

    uploadAttempted = true;
    await dependencies.storage.uploadFile(
      objectKey,
      processed.filePath,
      {
        contentType: "application/pdf",
        cacheControl: "31536000",
        upsert: false,
      }
    );

    const metadata: repository.PdfStorageMetadata = {
      storagePath: objectKey,
      originalFilename: processed.originalFilename,
      mimeType: "application/pdf",
      originalSizeBytes: processed.originalSizeBytes,
      optimizedSizeBytes: processed.optimizedSizeBytes,
      compressionPercent: processed.compressionPercent,
      pageCount: processed.pageCount,
      sha256: processed.sha256,
      compressionProfile: processed.profile,
      processor: processed.processor,
    };

    const updated = await dependencies.repository.replacePdf(
      id,
      current,
      dependencies.storage.getPublicUrl(objectKey),
      metadata
    );
    databaseUpdated = true;

    if (current.storagePath && current.storagePath !== objectKey) {
      try {
        await dependencies.storage.remove([current.storagePath]);
      } catch (cleanupError) {
        const message =
          cleanupError instanceof Error
            ? cleanupError.message
            : "Unknown cleanup error";
        await dependencies.repository
          .enqueueStorageCleanup(
            current.storagePath,
            "special-issue-replacement",
            message
          )
          .catch(queueError => {
            logPdfEvent("special_issue_pdf_cleanup_queue_failed", {
              objectKey: current.storagePath!,
              message:
                queueError instanceof Error
                  ? queueError.message
                  : "Unknown cleanup queue error",
            });
          });
      }
    }

    logPdfEvent("special_issue_pdf_replaced", {
      issueId: id,
      originalSizeBytes: processed.originalSizeBytes,
      optimizedSizeBytes: processed.optimizedSizeBytes,
      compressionPercent: processed.compressionPercent,
      pageCount: processed.pageCount,
      totalDurationMs: Number((performance.now() - startedAt).toFixed(2)),
    });
    return updated;
  } catch (error) {
    if (uploadAttempted && !databaseUpdated) {
      try {
        await dependencies.storage.remove([objectKey]);
      } catch (cleanupError) {
        const message =
          cleanupError instanceof Error
            ? cleanupError.message
            : "Unknown cleanup error";
        await dependencies.repository
          .enqueueStorageCleanup(
            objectKey,
            "replacement-compensation",
            message
          )
          .catch(() => undefined);
      }
    }
    throw error;
  } finally {
    if (
      processed.temporaryOutputPath &&
      processed.temporaryOutputPath !== file.path
    ) {
      await unlink(processed.temporaryOutputPath).catch(() => undefined);
    }
    await unlink(file.path).catch(() => undefined);
  }
}
