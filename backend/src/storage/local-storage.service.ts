import fs from "fs/promises";
import path from "path";
import { StorageService, UploadFileOptions } from "./storage.interface";

const uploadsRoot = path.join(process.cwd(), "uploads");

function resolveUploadPath(objectKey: string): string {
  const normalizedRoot = path.resolve(uploadsRoot);
  const resolvedPath = path.resolve(normalizedRoot, objectKey);
  const relativePath = path.relative(normalizedRoot, resolvedPath);

  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw Object.assign(new Error("Invalid storage path"), {
      statusCode: 400,
    });
  }

  return resolvedPath;
}

export class LocalStorageService implements StorageService {
  async upload(objectKey: string, buffer: Buffer, _options: UploadFileOptions): Promise<void> {
    const filePath = resolveUploadPath(objectKey);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  async remove(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (objectKey) => {
        try {
          await fs.unlink(resolveUploadPath(objectKey));
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
