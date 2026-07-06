import { randomUUID } from "crypto";
import * as repository from "./media.repository";
import { MEDIA_TYPE_VALUES, MediaType } from "./media.schema";
import { storageService } from "../../storage/storage.factory";
import sharp from "sharp";

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

async function createImageVariants(file: UploadInput) {
  const base = sharp(file.buffer).rotate();

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

  const fileType = detectMediaType(file.mimetype);
  const isImage = fileType === "image";

  const uploadId = randomUUID();
  const baseName = safeFilename(file.originalname.replace(/\.[^/.]+$/, "")) || uploadId;

  if (isImage) {
    const variants = await createImageVariants(file);

    const paths = {
      thumbnail: `media/${uploadId}/thumbnail.webp`,
      medium: `media/${uploadId}/medium.webp`,
      large: `media/${uploadId}/large.webp`,
    };

    await Promise.all([
      storageService.upload(paths.thumbnail, variants.thumbnail, {
        contentType: variants.mimetype,
        cacheControl: "31536000",
        upsert: false,
      }),
      storageService.upload(paths.medium, variants.medium, {
        contentType: variants.mimetype,
        cacheControl: "31536000",
        upsert: false,
      }),
      storageService.upload(paths.large, variants.large, {
        contentType: variants.mimetype,
        cacheControl: "31536000",
        upsert: false,
      }),
    ]);

    return repository.create({
      fileName: `${baseName}.webp`,
      diskName: paths.large,
      storagePath: paths.large,
      fileType,
      mimeType: variants.mimetype,
      size: variants.large.length,
    });
  }

  const safeOriginalName = safeFilename(file.originalname) || `${uploadId}.bin`;
  const objectKey = `media/${uploadId}/${safeOriginalName}`;

  await storageService.upload(objectKey, file.buffer, {
    contentType: file.mimetype || "application/octet-stream",
    upsert: false,
  });

  return repository.create({
    fileName: file.originalname,
    diskName: objectKey,
    storagePath: objectKey,
    fileType,
    mimeType: file.mimetype || "application/octet-stream",
    size: file.size || file.buffer.length,
  });
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
    throw Object.assign(new Error("Media not found"), { statusCode: 404 });
  }

  await storageService.remove([deleted.storagePath]);
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
