import fs from "fs/promises";
import path from "path";
import * as repository from "./media.repository";
import { MEDIA_TYPE_VALUES, MediaType } from "./media.schema";

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

function toSafeAbsolutePath(rawPath: string): string {
  const absolute = path.resolve(rawPath);
  const uploadsRoot = path.resolve(process.cwd(), "uploads");

  if (!absolute.startsWith(uploadsRoot)) {
    const err = Object.assign(new Error("Invalid media storage path"), { statusCode: 500 });
    throw err;
  }

  return absolute;
}

export async function getMedia(filters: GetMediaFilters = {}) {
  const parsedType = filters.type && (MEDIA_TYPE_VALUES as readonly string[]).includes(filters.type)
    ? (filters.type as MediaType)
    : undefined;

  const parsedPage = Number.isFinite(filters.page) ? Number(filters.page) : undefined;
  const parsedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : undefined;

  const repositoryFilters: repository.FindAllFilters = {};
  const search = filters.search?.trim();
  if (search) repositoryFilters.search = search;
  if (parsedType) repositoryFilters.type = parsedType;
  if (parsedPage !== undefined) repositoryFilters.page = parsedPage;
  if (parsedLimit !== undefined) repositoryFilters.limit = parsedLimit;

  return repository.findAll(repositoryFilters);
}

export type UploadInput = {
  originalname: string;
  filename: string;
  path: string;
  mimetype: string;
  size: number;
};

export async function createMediaFromUpload(file: UploadInput | undefined) {
  if (!file) {
    const err = Object.assign(new Error("No file uploaded"), { statusCode: 400 });
    throw err;
  }

  const storagePath = toSafeAbsolutePath(file.path);
  const fileType = detectMediaType(file.mimetype);

  try {
    return repository.create({
      fileName: file.originalname,
      diskName: file.filename,
      storagePath,
      fileType,
      mimeType: file.mimetype || "application/octet-stream",
      size: file.size || 0,
    });
  } catch (error) {
    await fs.unlink(storagePath).catch(() => undefined);
    throw error;
  }
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

export async function deleteMedia(id: string) {
  const deleted = await repository.remove(id);
  if (!deleted) {
    const err = Object.assign(new Error("Media not found"), { statusCode: 404 });
    throw err;
  }

  const absolutePath = toSafeAbsolutePath(deleted.storagePath);
  await fs.unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") throw error;
  });
}

export async function getMediaFile(id: string) {
  const media = await repository.findStorageById(id);
  if (!media) {
    const err = Object.assign(new Error("Media not found"), { statusCode: 404 });
    throw err;
  }

  const absolutePath = toSafeAbsolutePath(media.storagePath);
  return {
    path: absolutePath,
    mimeType: media.mimeType,
  };
}
