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

function mapRow(row: MediaRow) {
  return {
    id: String(row.id),
    fileName: row.file_name,
    filePath: row.storage_path,
    fileUrl: `/api/media/${row.id}/file`,
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

export async function findAll(filters: FindAllFilters = {}) {
  const where: string[] = [];
  const values: unknown[] = [];

  const push = (expression: string, value: unknown) => {
    values.push(value);
    where.push(expression.replace("?", `$${values.length}`));
  };

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const p = `$${values.length}`;
    where.push(`(file_name ILIKE ${p} OR mime_type ILIKE ${p})`);
  }

  if (filters.type) {
    push(`file_type = ?`, filters.type);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? (filters.page as number) : 1;
  const limit = Number.isFinite(filters.limit) && (filters.limit as number) > 0
    ? Math.min(filters.limit as number, 200)
    : 50;
  const offset = (page - 1) * limit;

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS count
     FROM media_files
     ${whereSql}`,
    values
  );
  const total = Number(countResult.rows[0]?.count ?? 0);

  values.push(limit, offset);
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;

  const result = await db.query(
    `SELECT *
     FROM media_files
     ${whereSql}
     ORDER BY created_at DESC
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values
  );

  return {
    data: result.rows.map((row) => mapRow(row as MediaRow)),
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

