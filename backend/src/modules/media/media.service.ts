import { randomUUID } from "crypto";
import * as repository from "./media.repository";
import { MEDIA_TYPE_VALUES, MediaType } from "./media.schema";
import { supabase, storageBucket } from "../../config/storage";
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

async function optimizeImage(file: UploadInput) {
  const optimizedBuffer = await sharp(file.buffer)
    .rotate()
    .resize({
      width: 1600,
      withoutEnlargement: true,
    })
    .webp({
      quality: 82,
      effort: 4,  
    })
    .toBuffer();

  return {
    buffer: optimizedBuffer,
    mimetype: "image/webp",
    extension: "webp",
    size: optimizedBuffer.length,
  };
}
export async function createMediaFromUpload(file: UploadInput | undefined) {
  if (!file) {
    const err = Object.assign(new Error("No file uploaded"), { statusCode: 400 });
    throw err;
  }

  const fileType = detectMediaType(file.mimetype);
  const isImage = fileType === "image";

  const uploadFile = isImage
    ? await optimizeImage(file)
    : {
        buffer: file.buffer,
        mimetype: file.mimetype || "application/octet-stream",
        extension: file.originalname.split(".").pop() || "bin",
        size: file.size || file.buffer.length,
      };

  const baseName = safeFilename(file.originalname.replace(/\.[^/.]+$/, ""));
  const objectKey = isImage
    ? `media/${Date.now()}-${randomUUID()}-${baseName}.webp`
    : `media/${Date.now()}-${randomUUID()}-${safeFilename(file.originalname)}`;

  if (!file.buffer || file.buffer.length === 0) {
    const err = Object.assign(new Error("Uploaded file is empty"), { statusCode: 400 });
    throw err;
  }

  const { error } = await supabase.storage
    .from(storageBucket)
    .upload(objectKey, uploadFile.buffer, {
      contentType: uploadFile.mimetype,
      upsert: false,
    });

  if (error) {
    const err = Object.assign(new Error("Failed to upload file"), { statusCode: 500 });
    throw err;
  }

  return repository.create({
    fileName: isImage ? `${baseName}.webp` : file.originalname,
    diskName: objectKey,
    storagePath: objectKey,
    fileType,
    mimeType: uploadFile.mimetype,
    size: uploadFile.size,
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
    const err = Object.assign(new Error("Media not found"), { statusCode: 404 });
    throw err;
  }

  await supabase.storage
  .from(storageBucket)
  .remove([deleted.storagePath])
  .catch((error) => {
    console.error("Failed to delete file from storage:", error);
  });
}

export async function getMediaFile(id: string) {
  const media = await repository.findStorageById(id);
  if (!media) {
    const err = Object.assign(new Error("Media not found"), { statusCode: 404 });
    throw err;
  }

 const { data }= supabase.storage
  .from(storageBucket)
  .getPublicUrl(media.storagePath);

  return {
    url: data.publicUrl,
    mimeType: media.mimeType,
  };
}
