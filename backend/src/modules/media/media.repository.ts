import db from "../../config/db";
import { MediaType } from "./media.schema";

type MediaRow = {
  id: string;
  file_name: string;
  disk_name: string;
  storage_path: string;
  file_type: MediaType;
  mime_type: string;
  size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string | null;
};

function getApiBaseUrl(): string {
  return process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
}

function buildMediaFileUrl(id: string): string {
  return `${getApiBaseUrl()}/api/media/${id}/file`;
}

const MEDIA_SELECT_COLUMNS = `
  m.id,
  m.file_name,
  m.disk_name,
  m.storage_path,
  m.file_type,
  m.mime_type,
  m.size,
  m.width,
  m.height,
  m.alt_text,
  m.caption,
  m.tags,
  m.created_at,
  m.updated_at
`;

function mapRow(row: MediaRow) {
  return {
    id: String(row.id),
    fileName: row.file_name,
    filePath: row.storage_path,
    fileUrl: buildMediaFileUrl(String(row.id)),
    fileType: row.file_type,
    mimeType: row.mime_type,
    size: Number(row.size),
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    altText: row.alt_text ?? undefined,
    caption: row.caption ?? undefined,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export type FindAllFilters = {
  search?: string;
  type?: MediaType;
  page?: number;
  limit?: number;
};

export async function findAll(
  filters: FindAllFilters = {}
) {
  const where: string[] = [];
  const values: unknown[] = [];

  /*
   * $1 is reserved for baseUrl in both SQL queries.
   * Dynamic filters therefore begin at $2.
   */
  const push = (
    expression: string,
    value: unknown
  ): void => {
    values.push(value);

    const parameterIndex =
      values.length + 1;

    where.push(
      expression.replace(
        "?",
        `$${parameterIndex}`
      )
    );
  };

  if (filters.search?.trim()) {
    const searchValue = `%${filters.search.trim()}%`;

    values.push(searchValue);

    const parameterIndex = values.length + 1;

    where.push(`
      (
        m.file_name ILIKE $${parameterIndex}
        OR m.mime_type ILIKE $${parameterIndex}
        OR COALESCE(m.alt_text, '') ILIKE $${parameterIndex}
        OR COALESCE(m.caption, '') ILIKE $${parameterIndex}
        OR EXISTS (
          SELECT 1
          FROM unnest(COALESCE(m.tags, ARRAY[]::text[])) AS tag
          WHERE tag ILIKE $${parameterIndex}
        )
      )
    `);
  }

  if (filters.type) {
    push(
      `m.file_type = ?::media_type`,
      filters.type
    );
  }

  const page =
    Number.isFinite(filters.page) &&
    Number(filters.page) > 0
      ? Number(filters.page)
      : 1;

  const limit =
    Number.isFinite(filters.limit) &&
    Number(filters.limit) > 0
      ? Math.min(
          Number(filters.limit),
          200
        )
      : 50;

  const offset =
    (page - 1) * limit;

  const baseUrl = getApiBaseUrl();

  const filterSql =
    where.length > 0
      ? `AND ${where.join(" AND ")}`
      : "";

  const countValues = [
    baseUrl,
    ...values,
  ];

  const countResult = await db.query(
    `SELECT
       COUNT(DISTINCT m.id)::int AS count
     FROM media_files m
     JOIN articles a
       ON a.image =
          $1::text ||
          '/api/media/' ||
          m.id::text ||
          '/file'
     WHERE LOWER(a.status::text) = 'published'
     ${filterSql}`,
    countValues
  );

  const total =
    Number(
      countResult.rows[0]?.count ?? 0
    );

  const queryValues = [
    baseUrl,
    ...values,
    limit,
    offset,
  ];

  const limitParam =
    `$${queryValues.length - 1}`;

  const offsetParam =
    `$${queryValues.length}`;

  const result = await db.query(
    `SELECT DISTINCT ON (m.id)
       ${MEDIA_SELECT_COLUMNS}
     FROM media_files m
     JOIN articles a
       ON a.image =
          $1::text ||
          '/api/media/' ||
          m.id::text ||
          '/file'
     WHERE LOWER(a.status::text) = 'published'
     ${filterSql}
     ORDER BY
       m.id,
       m.created_at DESC
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    queryValues
  );

  return {
    data: result.rows.map(
      row =>
        mapRow(row as MediaRow)
    ),
    total,
    page,
    limit,
  };
}

export async function findById(id: string) {
  const result = await db.query(`SELECT * FROM media_files WHERE id = $1`, [id]);
  if (!result.rows.length) return null;
  return mapRow(result.rows[0] as MediaRow);
}

export async function findStorageById(id: string): Promise<{ id: string; storagePath: string; mimeType: string } | null> {
  const result = await db.query(
    `SELECT id, storage_path, mime_type
     FROM media_files
     WHERE id = $1`,
    [id]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0] as { id: string; storage_path: string; mime_type: string };
  return {
    id: String(row.id),
    storagePath: row.storage_path,
    mimeType: row.mime_type,
  };
}

export type CreateMediaInput = {
  fileName: string;
  diskName: string;
  storagePath: string;
  fileType: MediaType;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
};

export async function create(input: CreateMediaInput) {
  const result = await db.query(
    `INSERT INTO media_files
    (
      file_name,
      disk_name,
      storage_path,
      file_type,
      mime_type,
      size,
      width,
      height
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *`,
    [
      input.fileName,
      input.diskName,
      input.storagePath,
      input.fileType,
      input.mimeType,
      input.size,
      input.width ?? null,
      input.height ?? null,
    ]
  );

  return mapRow(result.rows[0] as MediaRow);
}

export type UpdateMediaInput = {
  altText?: string;
  caption?: string;
  tags?: string[];
};

export async function update(id: string, input: UpdateMediaInput) {
  const result = await db.query(
    `UPDATE media_files
     SET
       alt_text = COALESCE($1, alt_text),
       caption = COALESCE($2, caption),
       tags = COALESCE($3, tags),
       updated_at = NOW()
     WHERE id = $4
     RETURNING *`,
    [
      input.altText ?? null,
      input.caption ?? null,
      input.tags ?? null,
      id,
    ]
  );

  if (!result.rows.length) return null;
  return mapRow(result.rows[0] as MediaRow);
}

export async function remove(id: string): Promise<{ id: string; storagePath: string } | null> {
  const usage = await findPublishedArticleUsageByMediaId(id);

  if (usage.length > 0) {
    throw Object.assign(
      new Error("Media is currently used by published articles."),
      {
        statusCode: 409,
        usage,
      }
    );
  }

  const result = await db.query(
    `DELETE FROM media_files
     WHERE id = $1
     RETURNING id, storage_path`,
    [id]
  );

  if (!result.rows.length) return null;
  const row = result.rows[0] as { id: string; storage_path: string };
  return {
    id: String(row.id),
    storagePath: row.storage_path,
  };
}

export async function findPublishedArticleUsageByMediaId(mediaId: string) {
  const baseUrl = getApiBaseUrl();

  const result = await db.query(
    `
    SELECT
      id,
      title,
      slug
    FROM articles
    WHERE LOWER(status::text) = 'published'
      AND image =
        $1::text ||
        '/api/media/' ||
        $2::text ||
        '/file'
    ORDER BY published_at DESC NULLS LAST, created_at DESC
    `,
    [baseUrl, mediaId]
  );

  return result.rows.map(row => ({
    id: String(row.id),
    title: row.title,
    slug: row.slug,
  }));
}