import path from 'node:path';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { supabase, storageBucket } from '../config/storage';
import { SupabaseStorageService } from './supabase-storage.service';
import { LocalStorageService } from './local-storage.service';
import type { StorageService, UploadFileOptions } from './storage.interface';
import { isPrivatePdfKey, privatePdfUrl } from './private-pdf-path';

export type PdfByteRange = { start: number; end: number };
export interface PrivatePdfStore extends StorageService {
  read(key: string, range: PdfByteRange, totalSize: number, signal: AbortSignal): Promise<Readable>;
}

const unavailable = () => Object.assign(new Error('Private PDF storage is unavailable'), { statusCode: 503 });

export class SupabasePrivatePdfStorage implements PrivatePdfStore {
  constructor(private readonly client = supabase,
    private readonly bucket = process.env.SUPABASE_PDF_STORAGE_BUCKET || 'paragon-pdfs',
    private readonly transport: typeof fetch = fetch) {}

  async assertPrivate(): Promise<void> {
    if (!/^[a-zA-Z0-9_-]+$/.test(this.bucket) || this.bucket === storageBucket) throw unavailable();
    const { data, error } = await this.client.storage.getBucket(this.bucket);
    if (error || !data || data.public !== false) throw unavailable();
  }

  private validateKey(key: string): void { if (!isPrivatePdfKey(key)) throw unavailable(); }

  async upload(key: string, buffer: Buffer, options: UploadFileOptions): Promise<void> {
    this.validateKey(key);
    await this.assertPrivate();
    await new SupabaseStorageService(this.client, this.bucket).upload(key, buffer, { ...options, cacheControl: '0', upsert: false });
  }
  async uploadFile(key: string, filePath: string, options: UploadFileOptions): Promise<void> {
    this.validateKey(key);
    await this.assertPrivate();
    await new SupabaseStorageService(this.client, this.bucket).uploadFile(key, filePath, { ...options, cacheControl: '0', upsert: false });
  }
  async remove(keys: string[]): Promise<void> {
    keys.forEach(key => this.validateKey(key));
    await this.assertPrivate();
    await new SupabaseStorageService(this.client, this.bucket).remove(keys);
  }
  getPublicUrl(key: string): string { return privatePdfUrl(key); }

  async read(key: string, range: PdfByteRange, totalSize: number, signal: AbortSignal): Promise<Readable> {
    this.validateKey(key);
    await this.assertPrivate();
    return readSupabasePdf(this.bucket, key, range, totalSize, signal, this.transport);
  }
}

// Neither caller-supplied URLs nor redirects can receive service credentials.
// Used for private delivery and the separately approved legacy migration.
export async function readSupabasePdf(bucket: string, key: string, range: PdfByteRange,
  totalSize: number, signal: AbortSignal, transport: typeof fetch = fetch): Promise<Readable> {
  if (!/^[a-zA-Z0-9_-]+$/.test(bucket) || !/^(?:private-)?special-issues\/[a-f0-9-]+\/[a-f0-9-]+\.pdf$/.test(key)) throw unavailable();
  const base = new URL(process.env.SUPABASE_URL!);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/' || base.search || base.hash) throw unavailable();
  const url = new URL(`/storage/v1/object/authenticated/${bucket}/${key}`, base);
  const response = await transport(url, {
    method: 'GET', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(60_000)]),
    headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY!}`,
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, Range: `bytes=${range.start}-${range.end}`,
      'Accept-Encoding': 'identity' },
  });
  const length = range.end - range.start + 1;
  const validStatus = response.status === 206 ||
    (response.status === 200 && range.start === 0 && length === totalSize);
  if (!validStatus || !response.body || Number(response.headers.get('content-length')) !== length ||
    (response.status === 206 && response.headers.get('content-range') !== `bytes ${range.start}-${range.end}/${totalSize}`) ||
    ![null, 'identity'].includes(response.headers.get('content-encoding'))) {
    await response.body?.cancel();
    throw unavailable();
  }
  return Readable.fromWeb(response.body as any);
}

export class LocalPrivatePdfStorage extends LocalStorageService implements PrivatePdfStore {
  constructor(private readonly privateRoot = path.join(process.cwd(), 'private-pdfs')) { super(privateRoot); }
  override getPublicUrl(key: string): string { return privatePdfUrl(key); }
  async read(key: string, range: PdfByteRange, totalSize: number, signal: AbortSignal): Promise<Readable> {
    if (!isPrivatePdfKey(key)) throw unavailable();
    const file = path.join(this.privateRoot, key);
    const info = await stat(file);
    if (!info.isFile() || info.size !== totalSize) throw unavailable();
    return createReadStream(file, { start: range.start, end: range.end, signal });
  }
}

export class RoutedStorageService implements StorageService {
  constructor(private readonly publicStorage: StorageService, private readonly privateStorage: StorageService) {}
  private store(key: string): StorageService {
    if (!key.startsWith('private-special-issues/')) return this.publicStorage;
    if (!isPrivatePdfKey(key)) throw unavailable();
    return this.privateStorage;
  }
  upload(key: string, buffer: Buffer, options: UploadFileOptions): Promise<void> { return this.store(key).upload(key, buffer, options); }
  uploadFile(key: string, file: string, options: UploadFileOptions): Promise<void> { return this.store(key).uploadFile(key, file, options); }
  async remove(keys: string[]): Promise<void> {
    // Validate every key before deleting anything from a mixed batch.
    keys.forEach(key => this.store(key));
    const privateKeys = keys.filter(isPrivatePdfKey);
    const publicKeys = keys.filter(key => !isPrivatePdfKey(key));
    if (privateKeys.length) await this.privateStorage.remove(privateKeys);
    if (publicKeys.length) await this.publicStorage.remove(publicKeys);
  }
  getPublicUrl(key: string): string { return this.store(key).getPublicUrl(key); }
}
