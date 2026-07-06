import fs from "fs/promises";
import path from "path";
import { StorageService, UploadFileOptions } from "./storage.interface";

const uploadsRoot = path.join(process.cwd(), "uploads");

export class LocalStorageService implements StorageService {
  async upload(objectKey: string, buffer: Buffer, _options: UploadFileOptions): Promise<void> {
    const filePath = path.join(uploadsRoot, objectKey);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async remove(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (objectKey) => {
        try {
          await fs.unlink(path.join(uploadsRoot, objectKey));
        } catch {
          // Ignore missing local files
        }
      })
    );
  }

  getPublicUrl(objectKey: string): string {
    const baseUrl = process.env.LOCAL_STORAGE_URL || "http://localhost:3000/uploads";
    return `${baseUrl}/${objectKey.replace(/\\/g, "/")}`;
  }
}