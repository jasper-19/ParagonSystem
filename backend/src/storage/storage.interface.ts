export type UploadFileOptions = {
    contentType: string;
    cacheControl?: string;
    upsert?: boolean;
};

export interface StorageService {
    upload(path: string, buffer: Buffer, options?: UploadFileOptions): Promise<void>;
    uploadFile(path: string, filePath: string, options?: UploadFileOptions): Promise<void>;
    remove(path: string[]): Promise<void>;
    getPublicUrl(path: string): string;
}
