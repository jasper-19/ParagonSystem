import { randomUUID } from "crypto";
import * as repository from "./media.repository";
import { MEDIA_TYPE_VALUES, MediaType } from "./media.schema";
import { storageService } from "../../storage/storage.factory";
import sharp from "sharp";
import * as settingsService from "../settings/settings.service";
import { mediaStoragePaths } from "./media-storage-paths";
import { removeUnreferencedStorageObject } from "../../storage/storage-cleanup.repository";
import db from "../../config/db";
import { withStorageCancellation } from "../../storage/storage-fetch";

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
]);

const CANONICAL_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "video/mp4": "mp4",
  "video/webm": "webm",
};

function hasExpectedFileSignature(buffer: Buffer, mimeType: string): boolean {
  switch (mimeType) {
    case "application/pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    case "video/mp4":
      return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
    case "video/webm":
      return buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
    case "audio/ogg":
      return buffer.subarray(0, 4).toString("ascii") === "OggS";
    case "audio/wav":
    case "audio/x-wav":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WAVE"
      );
    case "audio/mpeg":
      return (
        buffer.subarray(0, 3).toString("ascii") === "ID3" ||
        (buffer.length >= 2 &&
          buffer[0]! === 0xff &&
          (buffer[1]! & 0xe0) === 0xe0)
      );
    default:
      return true;
  }
}

export type GetMediaFilters = {
  search?: string;
  type?: string;
  page?: number;
  limit?: number;
};

function detectMediaType(mimeType: string): MediaType {
  const mime = String(mimeType || "").toLowerCase();
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  return "document";
}

  function safeFilename(name: string) {
    return name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.-]/g, "");
  }

export async function getMedia(filters: GetMediaFilters = {}) {
  const parsedType = 
  filters.type && (MEDIA_TYPE_VALUES as readonly string[]).includes(filters.type)
    ? (filters.type as MediaType)
    : undefined;

  const repositoryFilters: repository.FindAllFilters = {};
  const search = filters.search?.trim();

  if (search) repositoryFilters.search = search;
  if (parsedType) repositoryFilters.type = parsedType;
  if (filters.page !== undefined) repositoryFilters.page = filters.page;
  if (filters.limit !== undefined) repositoryFilters.limit = filters.limit;

  return repository.findAll(repositoryFilters);
}

export type UploadInput = {
  originalname: string;
  buffer: Buffer;
  mimetype: string;
  size: number;
};

const MAX_ACTIVE_UPLOADS = Math.max(1, Math.min(2, Number(db.options.max ?? 5) - 1));
let activeUploads = 0;

/** Reserve pool capacity for ordinary requests while storage I/O holds a connection. */
export async function uploadMediaObjects<T>(
  objects: { path: string; buffer: Buffer; contentType: string; cacheControl?: string }[],
  create: (connection: Pick<typeof db, 'query'>) => Promise<T>
) {
  if (activeUploads >= MAX_ACTIVE_UPLOADS) {
    throw Object.assign(new Error('Media uploads are busy. Please try again shortly.'), { statusCode: 503 });
  }
  activeUploads++;
  try {
    return await persistMediaObjects(objects, create);
  } finally {
    activeUploads--;
  }
}

/** Drain all writes before cleanup, including writes that finish after a peer fails. */
async function persistMediaObjects<T>(
  objects: { path: string; buffer: Buffer; contentType: string; cacheControl?: string }[],
  create: (connection: Pick<typeof db, 'query'>) => Promise<T>
) {
  const paths = objects.map(object => object.path);
  const client = await db.connect();
  let transactionStarted = false;
  let discardConnection = false;
  let writesStarted = false;
  let failure: unknown;
  try {
    // Commit recovery intent before external writes. The grace period protects
    // the interval before we lock the jobs against the retry worker.
    await client.query(
      `INSERT INTO paragon_internal.storage_cleanup_jobs (storage_path, reason, attempts)
       SELECT path, 'media_upload_pending', 1 FROM unnest($1::text[]) AS path`, [paths]
    );
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '120s'");
    const jobs = await client.query(
      `SELECT storage_path FROM paragon_internal.storage_cleanup_jobs
       WHERE storage_path = ANY($1::text[]) AND completed_at IS NULL AND attempts = 1 FOR UPDATE`, [paths]
    );
    if (jobs.rows.length !== paths.length) throw new Error('Media upload recovery reservation expired');
    writesStarted = true;
    const results = await withStorageCancellation(AbortSignal.timeout(60_000), () => Promise.allSettled(objects.map(object => storageService.upload(
      object.path, object.buffer, { contentType: object.contentType, upsert: false,
        ...(object.cacheControl ? { cacheControl: object.cacheControl } : {}) }
    ))));
    const uploadFailure = results.find(result => result.status === 'rejected');
    if (uploadFailure?.status === 'rejected') throw uploadFailure.reason;
    const created = await create(client);
    await client.query(
      `UPDATE paragon_internal.storage_cleanup_jobs SET completed_at = NOW(), updated_at = NOW()
       WHERE storage_path = ANY($1::text[]) AND completed_at IS NULL`, [paths]
    );
    await client.query('COMMIT');
    transactionStarted = false;
    return created;
  } catch (error) {
    failure = error;
    if (transactionStarted) await client.query('ROLLBACK').catch(() => { discardConnection = true; });
  } finally {
    client.release(discardConnection);
  }
  for (const path of writesStarted ? paths : []) {
    try { await removeUnreferencedStorageObject(path, () => storageService.remove([path])); }
    catch { console.error('Media upload cleanup requires retry'); }
  }
  throw failure;
}

async function createImageVariants(file: UploadInput) {
  const base = sharp(file.buffer, {
    limitInputPixels: 40_000_000,
  }).rotate();

  const [thumbnail, medium, large] = await Promise.all([
    base.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 78, effort: 4 }).toBuffer(),
    base.clone().resize({ width: 900, withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer(),
    base.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer(),
  ]);

  return {
    thumbnail,
    medium,
    large,
    mimetype: "image/webp",
  };
}

export async function createMediaFromUpload(file: UploadInput | undefined) {
  if (!file) {
    throw Object.assign(new Error("No file uploaded"), { statusCode: 400 });
  }

  if (!file.buffer || file.buffer.length === 0) {
    throw Object.assign(new Error("Uploaded file is empty"), { statusCode: 400 });
  }

  const mimeType = String(file.mimetype || "").toLowerCase();
  const { publishingMedia } = await settingsService.getSettings();
  if (
    !ALLOWED_MIME_TYPES.has(mimeType) ||
    !publishingMedia.allowedMimeTypes.includes(mimeType as never)
  ) {
    throw Object.assign(new Error("Unsupported media type"), { statusCode: 415 });
  }
  if (file.size > publishingMedia.maxUploadSizeMb * 1024 * 1024) {
    throw Object.assign(new Error("File exceeds the configured upload limit"), {
      statusCode: 413,
    });
  }

  const fileType = detectMediaType(mimeType);
  const isImage = fileType === "image";

  if (isImage) {
    const formats: Record<string, string> = {
      "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
    };
    try {
      const metadata = await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
      if (metadata.format !== formats[mimeType]) throw new Error("Mismatched image format");
    } catch {
      throw Object.assign(new Error("File content does not match its image type"), { statusCode: 400 });
    }
  }

  if (!isImage && !hasExpectedFileSignature(file.buffer, mimeType)) {
    throw Object.assign(new Error("File content does not match its media type"), {
      statusCode: 400,
    });
  }

  const uploadId = randomUUID();
  const baseName = safeFilename(file.originalname.replace(/\.[^/.]+$/, "")) || uploadId;

  if (isImage && publishingMedia.optimizeImages) {
    let variants;
    try {
      variants = await createImageVariants(file);
    } catch {
      throw Object.assign(new Error("Invalid or corrupted image"), {
        statusCode: 400,
      });
    }

    const paths = {
      thumbnail: `media/${uploadId}/thumbnail.webp`,
      medium: `media/${uploadId}/medium.webp`,
      large: `media/${uploadId}/large.webp`,
    };

    return uploadMediaObjects([
      { path: paths.thumbnail, buffer: variants.thumbnail, contentType: variants.mimetype, cacheControl: '31536000' },
      { path: paths.medium, buffer: variants.medium, contentType: variants.mimetype, cacheControl: '31536000' },
      { path: paths.large, buffer: variants.large, contentType: variants.mimetype, cacheControl: '31536000' },
    ], connection => repository.create({
      fileName: `${baseName}.webp`,
      diskName: paths.large,
      storagePath: paths.large,
      fileType,
      mimeType: variants.mimetype,
      size: variants.large.length,
    }, connection));
  }

  const extension = CANONICAL_EXTENSIONS[mimeType];
  if (!extension) {
    throw Object.assign(new Error("Unsupported media type"), { statusCode: 415 });
  }

  const objectKey = `media/${uploadId}/${uploadId}.${extension}`;

  if (isImage) {
    try {
      await sharp(file.buffer, { limitInputPixels: 40_000_000 }).metadata();
    } catch {
      throw Object.assign(new Error("Invalid or corrupted image"), {
        statusCode: 400,
      });
    }
  }

  return uploadMediaObjects([{ path: objectKey, buffer: file.buffer, contentType: mimeType }], connection => repository.create({
    fileName: file.originalname,
    diskName: objectKey,
    storagePath: objectKey,
    fileType,
    mimeType,
    size: file.buffer.length,
  }, connection));
}

export async function updateMedia(id: string, data: unknown) {
  const payload = data as {
    altText?: string;
    caption?: string;
    tags?: string[];
  };

  const updateData: repository.UpdateMediaInput = {};
  if (payload.altText !== undefined) updateData.altText = payload.altText;
  if (payload.caption !== undefined) updateData.caption = payload.caption;
  if (payload.tags !== undefined) updateData.tags = payload.tags;

  const updated = await repository.update(id, updateData);

  if (!updated) {
    const err = Object.assign(new Error("Media not found"), { statusCode: 404 });
    throw err;
  }

  return updated;
}

export async function deleteMedia(id: string, afterDelete?: () => Promise<void>) {
  const deleted = await repository.remove(id);

  if (!deleted) {
    throw Object.assign(new Error("Media not found"), { statusCode: 404 });
  }

  // The row is already deleted even if subsequent object cleanup fails.
  try {
    await afterDelete?.();
  } finally {
    for (const path of mediaStoragePaths(deleted.storagePath)) {
      try { await removeUnreferencedStorageObject(path, () => storageService.remove([path])); }
      catch { console.error('Deleted media cleanup requires retry'); }
    }
  }
}

export async function getMediaFile(id: string) {
  const media = await repository.findStorageById(id);

  if (!media) {
    throw Object.assign(new Error("Media not found"), { statusCode: 404 });
  }

  const url = await storageService.getPublicUrl(media.storagePath);

  return {
    url,
    mimeType: media.mimeType,
  };
}
