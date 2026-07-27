import { supabase, storageBucket } from "../config/storage";
import { StorageService, UploadFileOptions } from "./storage.interface";
import { readFile } from "node:fs/promises";

export class SupabaseStorageService implements StorageService {
    async upload(path: string, buffer: Buffer, options: UploadFileOptions): Promise<void> {
    const uploadOptions = {
        contentType: options.contentType,
        upsert: options.upsert ?? false,
        ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
    };

    const { error } = await supabase.storage
        .from(storageBucket)
        .upload(path, buffer, uploadOptions);

    if (error) {
        throw Object.assign(new Error("Storage upload failed"), {
          statusCode: 502,
        });
    }
    }

  async uploadFile(
    path: string,
    filePath: string,
    options: UploadFileOptions
  ): Promise<void> {
    // supabase-js standard uploads do not accept a Node file path. Keep the
    // processor disk-based, then buffer only the final bounded artifact here.
    const buffer = await readFile(filePath);
    await this.upload(path, buffer, options);
  }

  async remove(paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from(storageBucket).remove(paths);

    if (error) {
      throw Object.assign(new Error("Storage object deletion failed"), {
        statusCode: 502,
      });
    }
  }

  getPublicUrl(path: string): string {
    const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
