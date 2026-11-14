import fs from "fs/promises";
import path from "path";
import { constants } from "node:fs";
import { StorageService, UploadFileOptions } from "./storage.interface";

function resolveUploadPath(uploadsRoot: string, objectKey: string): string {
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
  constructor(private readonly root = path.join(process.cwd(), "uploads")) {}
  async upload(objectKey: string, buffer: Buffer, _options: UploadFileOptions): Promise<void> {
    const filePath = resolveUploadPath(this.root, objectKey);

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, buffer, { flag: _options.upsert ? "w" : "wx" });
  }

  async uploadFile(
    objectKey: string,
    sourcePath: string,
    _options: UploadFileOptions
  ): Promise<void> {
    const destinationPath = resolveUploadPath(this.root, objectKey);
    await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    await fs.copyFile(sourcePath, destinationPath, _options.upsert ? 0 : constants.COPYFILE_EXCL);
  }

  async remove(paths: string[]): Promise<void> {
    await Promise.all(
      paths.map(async (objectKey) => {
        try {
          await fs.unlink(resolveUploadPath(this.root, objectKey));
        } catch (error) {
          const code = (error as NodeJS.ErrnoException).code;
          if (code !== "ENOENT") throw error;
        }
      })
    );
  }

  getPublicUrl(objectKey: string): string {
    const baseUrl = process.env.LOCAL_STORAGE_URL || "http://localhost:3000/uploads";
    return `${baseUrl}/${objectKey.replace(/\\/g, "/")}`;
  }
}
