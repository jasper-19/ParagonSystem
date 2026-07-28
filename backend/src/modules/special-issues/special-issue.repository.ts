import db from "../../config/db";
import type {
  IssueStatus,
  IssueType,
  SpecialIssueListQuery,
} from "./special-issue.schema";

export type PdfStorageMetadata = {
  storagePath: string;
  originalFilename: string;
  mimeType: "application/pdf";
  originalSizeBytes: number;
  optimizedSizeBytes: number;
  compressionPercent: number;
  pageCount: number;
  sha256: string;
  compressionProfile: string;
  processor: string;
};

export type CreateSpecialIssueRecord = {
  title: string;
  slug: string;
  type: IssueType;
  academicYear: string;
  description?: string | undefined;
  coverImage: string;
  pdfUrl: string;
  publishedAt?: string | undefined;
  status: IssueStatus;
  pdfMetadata?: PdfStorageMetadata;
};

type SpecialIssueRow = {
  id: string;
  title: string;
  slug: string;
  type: IssueType;
  academic_year: string;
  description: string | null;
  cover_image: string;
  pdf_url: string;
  status: IssueStatus;
  published_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date | null;
  pdf_storage_path?: string | null;
  pdf_original_filename?: string | null;
  pdf_original_size_bytes?: string | number | null;
  pdf_optimized_size_bytes?: string | number | null;
  pdf_compression_percent?: string | number | null;
  pdf_page_count?: string | number | null;
  pdf_sha256?: string | null;
  pdf_compression_profile?: string | null;
  pdf_processor?: string | null;
};

const SPECIAL_ISSUE_SELECT_COLUMNS = `
  id,
  title,
  slug,
  type,
  academic_year,
  description,
  cover_image,
  pdf_url,
  status,
  published_at,
  created_at,
  updated_at,
  pdf_storage_path,
  pdf_original_filename,
  pdf_mime_type,
  pdf_original_size_bytes,
  pdf_optimized_size_bytes,
  pdf_compression_percent,
  pdf_page_count,
  pdf_sha256,
  pdf_compression_profile,
  pdf_processor
`;

const SORT_COLUMNS: Record<
  SpecialIssueListQuery["sortBy"],
  string
> = {
  publishedAt: "published_at",
  createdAt: "created_at",
  title: "LOWER(title)",
  academicYear: "academic_year",
};

export type SpecialIssueListResult = {
  items: ReturnType<typeof mapRow>[];
  page: number;
  pageSize: number;
  hasMore: boolean;
};

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, character => `\\${character}`);
}

async function findList(
  query: SpecialIssueListQuery,
  publicOnly: boolean
): Promise<SpecialIssueListResult> {
  const conditions: string[] = [];
  const values: unknown[] = [];
  const addCondition = (sql: string, value: unknown): void => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };

  if (publicOnly) {
    conditions.push("status = 'published'");
  } else if (query.status) {
    addCondition("status = ?", query.status);
  }
  if (query.type) {
    addCondition("type = ?", query.type);
  }
  if (query.search) {
    addCondition(
      `(title ILIKE ? ESCAPE '\\'
        OR slug ILIKE $${values.length + 1} ESCAPE '\\'
        OR academic_year ILIKE $${values.length + 1} ESCAPE '\\'
        OR COALESCE(description, '') ILIKE $${values.length + 1} ESCAPE '\\')`,
      `%${escapeLikePattern(query.search)}%`
    );
  }

  const sortColumn = SORT_COLUMNS[query.sortBy];
  const sortOrder = query.sortOrder === "asc" ? "ASC" : "DESC";
  const where = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : "";
  const offset = (query.page - 1) * query.limit;
  values.push(query.limit + 1, offset);
  const limitParameter = `$${values.length - 1}`;
  const offsetParameter = `$${values.length}`;
  const result = await db.query(
    `SELECT ${SPECIAL_ISSUE_SELECT_COLUMNS}
     FROM special_issues
     ${where}
     ORDER BY ${sortColumn} ${sortOrder} NULLS LAST, id ${sortOrder}
     LIMIT ${limitParameter}
     OFFSET ${offsetParameter}`,
    values
  );
  const hasMore = result.rows.length > query.limit;

  return {
    items: result.rows
      .slice(0, query.limit)
      .map(row => mapRow(row as SpecialIssueRow)),
    page: query.page,
    pageSize: query.limit,
    hasMore,
  };
}

function safeStoredMediaUrl(value: unknown, type: "image" | "pdf"): string {
  const candidate = String(value ?? "");

  try {
    if (new URL(candidate).protocol === "https:") {
      return candidate;
    }
  } catch {
    // Continue with data URL validation.
  }

  const dataUrlPattern =
    type === "image"
      ? /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i
      : /^data:application\/pdf;base64,[a-z0-9+/=\r\n]+$/i;

  return dataUrlPattern.test(candidate) ? candidate : "";
}

/** Map DB row -> API response object */
function mapRow(row: SpecialIssueRow) {
  const mapped = {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    type: row.type,
    academicYear: row.academic_year,
    description: row.description ?? undefined,
    coverImage: safeStoredMediaUrl(row.cover_image, "image"),
    pdfUrl: safeStoredMediaUrl(row.pdf_url, "pdf"),
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };

  if (!row.pdf_storage_path) return mapped;

  return {
    ...mapped,
    pdfMetadata: {
      originalFilename: row.pdf_original_filename,
      originalSizeBytes: Number(row.pdf_original_size_bytes),
      optimizedSizeBytes: Number(row.pdf_optimized_size_bytes),
      compressionPercent: Number(row.pdf_compression_percent),
      pageCount: Number(row.pdf_page_count),
      sha256: row.pdf_sha256,
      compressionProfile: row.pdf_compression_profile,
      processor: row.pdf_processor,
    },
  };
}

export async function findPublished(query: SpecialIssueListQuery) {
  return findList(query, true);
}

export async function findAdmin(query: SpecialIssueListQuery) {
  return findList(query, false);
}

export async function findBySlug(
  slug: string,
  includeUnpublished = false
) {
  const publicationFilter = includeUnpublished
    ? ""
    : "AND status = 'published'";

  const result = await db.query(
    `SELECT ${SPECIAL_ISSUE_SELECT_COLUMNS}
     FROM special_issues
     WHERE slug = $1
     ${publicationFilter}
     LIMIT 1`,
    [slug]
  );

  return result.rows[0]
    ? mapRow(result.rows[0] as SpecialIssueRow)
    : null;
}

export async function create(data: CreateSpecialIssueRecord) {

  if (!data) {
    throw new Error("Issue data is missing");
  }

  const d = data;
  const status = d.status;

  const publishedAtRaw = d.publishedAt;
  const publishedAt =
    typeof publishedAtRaw === "string" && publishedAtRaw.trim() !== ""
      ? new Date(publishedAtRaw)
      : status === "published"
        ? new Date()
        : null;

  try {
    const result = await db.query(
      `INSERT INTO special_issues
      (
        title,
        slug,
        type,
        academic_year,
        description,
        cover_image,
        pdf_url,
        status,
        published_at,
        pdf_storage_path,
        pdf_original_filename,
        pdf_mime_type,
        pdf_original_size_bytes,
        pdf_optimized_size_bytes,
        pdf_compression_percent,
        pdf_page_count,
        pdf_sha256,
        pdf_compression_profile,
        pdf_processor
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
      )
      RETURNING ${SPECIAL_ISSUE_SELECT_COLUMNS}`,
      [
        d.title,
        d.slug,
        d.type,
        d.academicYear,
        d.description === "" ? null : (d.description ?? null),
        d.coverImage,
        d.pdfUrl,
        d.status,
        publishedAt,
        d.pdfMetadata?.storagePath ?? null,
        d.pdfMetadata?.originalFilename ?? null,
        d.pdfMetadata?.mimeType ?? null,
        d.pdfMetadata?.originalSizeBytes ?? null,
        d.pdfMetadata?.optimizedSizeBytes ?? null,
        d.pdfMetadata?.compressionPercent ?? null,
        d.pdfMetadata?.pageCount ?? null,
        d.pdfMetadata?.sha256 ?? null,
        d.pdfMetadata?.compressionProfile ?? null,
        d.pdfMetadata?.processor ?? null,
      ]
    );

    return mapRow(result.rows[0] as SpecialIssueRow);
  } catch (error) {
    console.error("Error creating special issue:", error);
    throw error;
  }
}

export async function update(id: string, data: unknown) {

  if (!id) throw new Error("Missing issue ID");
  if (!data) throw new Error("Issue update data is missing");

  const d = data as Record<string, unknown>;

  const set: string[] = [];
  const values: unknown[] = [];

  const push = (column: string, value: unknown) => {
    values.push(value);
    set.push(`${column} = $${values.length}`);
  };

  if ("title" in d) push("title", d.title);
  if ("slug" in d) push("slug", d.slug);
  if ("type" in d) push("type", d.type);
  if ("academicYear" in d) push("academic_year", d.academicYear);
  if ("description" in d) push("description", d.description === "" ? null : (d.description ?? null));
  if ("coverImage" in d) push("cover_image", d.coverImage);
  if ("status" in d) push("status", d.status);

  if ("publishedAt" in d) {
    const publishedAtRaw = d.publishedAt;
    const publishedAt =
      typeof publishedAtRaw === "string" && publishedAtRaw.trim() !== "" ? new Date(publishedAtRaw) : null;
    push("published_at", publishedAt);
  }

  if (set.length === 0) {
    throw Object.assign(new Error("No valid fields provided for update"), { statusCode: 400 });
  }

  try {
    const result = await db.query(
      `UPDATE special_issues
       SET ${set.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING ${SPECIAL_ISSUE_SELECT_COLUMNS}`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      throw Object.assign(new Error("Issue not found"), { statusCode: 404 });
    }

    return mapRow(result.rows[0] as SpecialIssueRow);
  } catch (error) {
    console.error("Error updating special issue:", error);
    throw error;
  }
}

export type PdfMutationState = {
  id: string;
  pdfUrl: string;
  storagePath: string | null;
};

export async function findPdfMutationState(
  id: string
): Promise<PdfMutationState | null> {
  const result = await db.query(
    `SELECT id, pdf_url, pdf_storage_path
     FROM special_issues
     WHERE id = $1`,
    [id]
  );
  if (!result.rows[0]) return null;
  return {
    id: String(result.rows[0].id),
    pdfUrl: String(result.rows[0].pdf_url),
    storagePath: result.rows[0].pdf_storage_path
      ? String(result.rows[0].pdf_storage_path)
      : null,
  };
}

export async function replacePdf(
  id: string,
  expected: PdfMutationState,
  pdfUrl: string,
  metadata: PdfStorageMetadata
) {
  const isLegacyInlinePdf =
    expected.storagePath === null &&
    expected.pdfUrl.startsWith("data:application/pdf;base64,");
  const optimisticPredicate = isLegacyInlinePdf
    ? "pdf_storage_path IS NULL"
    : "pdf_url = $13 AND pdf_storage_path IS NOT DISTINCT FROM $14";
  const optimisticParams = isLegacyInlinePdf
    ? []
    : [expected.pdfUrl, expected.storagePath];

  const result = await db.query(
    `UPDATE special_issues
     SET
       pdf_url = $1,
       pdf_storage_path = $2,
       pdf_original_filename = $3,
       pdf_mime_type = $4,
       pdf_original_size_bytes = $5,
       pdf_optimized_size_bytes = $6,
       pdf_compression_percent = $7,
       pdf_page_count = $8,
       pdf_sha256 = $9,
       pdf_compression_profile = $10,
       pdf_processor = $11,
       updated_at = NOW()
     WHERE id = $12
       AND ${optimisticPredicate}
     RETURNING ${SPECIAL_ISSUE_SELECT_COLUMNS}`,
    [
      pdfUrl,
      metadata.storagePath,
      metadata.originalFilename,
      metadata.mimeType,
      metadata.originalSizeBytes,
      metadata.optimizedSizeBytes,
      metadata.compressionPercent,
      metadata.pageCount,
      metadata.sha256,
      metadata.compressionProfile,
      metadata.processor,
      id,
      ...optimisticParams,
    ]
  );

  if (!result.rows[0]) {
    throw Object.assign(
      new Error("Special Issue changed during PDF replacement"),
      { statusCode: 409 }
    );
  }
  return mapRow(result.rows[0] as SpecialIssueRow);
}

export type RemoveArchivedResult =
  | { state: "not-found" }
  | { state: "not-archived" }
  | {
      state: "deleted";
      id: string;
      storagePath: string | null;
    };

export async function removeArchived(
  id: string
): Promise<RemoveArchivedResult> {
  const result = await db.query(
    `WITH target AS (
       SELECT id, status
       FROM special_issues
       WHERE id = $1
     ),
     deleted AS (
       DELETE FROM special_issues
       WHERE id = $1
         AND status = 'archived'
       RETURNING id, pdf_storage_path
     )
     SELECT
       target.id AS target_id,
       target.status,
       deleted.id AS deleted_id,
       deleted.pdf_storage_path
     FROM target
     LEFT JOIN deleted ON deleted.id = target.id`,
    [id]
  );

  const row = result.rows[0];
  if (!row) return { state: "not-found" };
  if (!row.deleted_id) return { state: "not-archived" };
  return {
    state: "deleted",
    id: String(row.deleted_id),
    storagePath: row.pdf_storage_path
      ? String(row.pdf_storage_path)
      : null,
  };
}

export async function enqueueStorageCleanup(
  storagePath: string,
  reason: string,
  errorMessage: string
): Promise<void> {
  await db.query(
    `INSERT INTO paragon_internal.storage_cleanup_jobs
       (storage_path, reason, last_error)
     VALUES ($1, $2, $3)
     ON CONFLICT (storage_path)
     WHERE completed_at IS NULL
     DO UPDATE SET
       reason = EXCLUDED.reason,
       last_error = EXCLUDED.last_error,
       updated_at = NOW()`,
    [storagePath, reason, errorMessage.slice(0, 500)]
  );
}

export async function getDashboardSummary() {
  const [totals, recent] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'published') AS published,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'draft') AS drafts,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'archived') AS archived
      FROM special_issues
    `),

    db.query(`
      SELECT
        id,
        title,
        slug,
        type,
        academic_year,
        status,
        published_at,
        created_at
      FROM special_issues
      ORDER BY created_at DESC
      LIMIT 5
    `)
  ]);

  return {
    total: Number(totals.rows[0].total),
    published: Number(totals.rows[0].published),
    drafts: Number(totals.rows[0].drafts),
    archived: Number(totals.rows[0].archived),
    recent: recent.rows.map(row => ({
      id: String(row.id),
      title: row.title,
      slug: row.slug,
      type: row.type,
      academicYear: row.academic_year,
      status: row.status,
      publishedAt: row.published_at ?? undefined,
      createdAt: row.created_at,
    })),
  };
}
