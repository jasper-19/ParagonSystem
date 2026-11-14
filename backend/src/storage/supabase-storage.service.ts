import { supabase, storageBucket } from "../config/storage";
import { StorageService, UploadFileOptions } from "./storage.interface";
import { createReadStream } from "node:fs";
import { finished } from "node:stream/promises";
import { withStorageCancellation } from "./storage-fetch";

export class SupabaseStorageService implements StorageService {
  constructor(private readonly client = supabase, private readonly bucket = storageBucket) {}
    async upload(path: string, buffer: Buffer, options: UploadFileOptions): Promise<void> {
    const uploadOptions = {
        contentType: options.contentType,
        upsert: options.upsert ?? false,
        ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
    };

    const { error } = await this.client.storage
        .from(this.bucket)
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
    const stream = createReadStream(filePath);
    // The installed storage-js SDK accepts Node streams and supplies fetch's
    // required duplex option. Avoid allocating another complete PDF in memory.
    // Retain an error listener until destroy finishes, including failed fetches.
    stream.on("error", () => undefined);
    try {
      const { error } = await withStorageCancellation(options.signal, () => this.client.storage.from(this.bucket).upload(path, stream, {
        contentType: options.contentType,
        upsert: options.upsert ?? false,
        ...(options.cacheControl ? { cacheControl: options.cacheControl } : {}),
      }));
      if (error) throw error;
    } catch {
      throw Object.assign(new Error("Storage upload failed"), { statusCode: 502 });
    } finally {
      stream.destroy();
      await finished(stream).catch(() => undefined);
    }
  }

  async remove(paths: string[]): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove(paths);

    if (error) {
      throw Object.assign(new Error("Storage object deletion failed"), {
        statusCode: 502,
      });
    }
  }

  getPublicUrl(path: string): string {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }
}
