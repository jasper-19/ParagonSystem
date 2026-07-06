import { supabase, storageBucket } from "../config/storage";
import { StorageService, UploadFileOptions } from "./storage.interface";

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
        throw Object.assign(new Error(error.message), { statusCode: 500 });
    }
    }

  async remove(paths: string[]): Promise<void> {
    const { error } = await supabase.storage.from(storageBucket).remove(paths);

    if (error) {
      console.error("Failed to delete files from Supabase Storage:", error.message);
    }
  }

  getPublicUrl(path: string): string {
    const { data } = supabase.storage.from(storageBucket).getPublicUrl(path);
    return data.publicUrl;
  }
}