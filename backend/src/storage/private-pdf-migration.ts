import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { migratePdfKey, privatePdfUrl } from './private-pdf-path';
import { exactPdfBytes } from './pdf-stream';

export type MigrationPdf = { id: string; storagePath: string; pdfUrl: string; size: number; sha256: string };
export type MigrationDependencies = {
  readSource(key: string, size: number, signal: AbortSignal): Promise<Readable>;
  readPrivate(key: string, size: number, signal: AbortSignal): Promise<Readable>;
  upload(key: string, file: string, signal: AbortSignal): Promise<void>;
  swap(record: MigrationPdf, key: string, url: string): Promise<boolean>;
};

export async function verifyPdfStream(source: Readable, size: number, signal: AbortSignal,
  file?: string): Promise<string> {
  const hash = createHash('sha256');
  const bounded = exactPdfBytes(size);
  bounded.on('data', chunk => hash.update(chunk));
  await pipeline(source, bounded,
    file ? createWriteStream(file, { flags: 'wx', mode: 0o600 }) : new Writable({ write(_chunk, _encoding, done) { done(); } }),
    { signal });
  return hash.digest('hex');
}

export async function migratePrivatePdf(record: MigrationPdf, deps: MigrationDependencies): Promise<boolean> {
  const target = migratePdfKey(record.storagePath);
  if (!target || !Number.isSafeInteger(record.size) || record.size <= 0 || record.size > 100 * 1024 * 1024 ||
    !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('PDF requires manual migration review');
  const directory = await mkdtemp(path.join(os.tmpdir(), 'paragon-private-pdf-'));
  const file = path.join(directory, 'verified.pdf');
  const signal = AbortSignal.timeout(180_000);
  try {
    const sourceHash = await verifyPdfStream(await deps.readSource(record.storagePath, record.size, signal), record.size, signal, file);
    if (sourceHash !== record.sha256) throw new Error('Source PDF checksum mismatch');
    // Retry-safe immutable destination. If upload reports an existing object or
    // a transport error, only independently verified matching bytes permit CAS.
    try { await deps.upload(target, file, signal); } catch {}
    const targetHash = await verifyPdfStream(await deps.readPrivate(target, record.size, signal), record.size, signal);
    if (targetHash !== sourceHash) throw new Error('Private PDF checksum mismatch');
    return await deps.swap(record, target, privatePdfUrl(target));
    // Public originals are deliberately never deleted or enqueued here.
  } finally { await rm(directory, { recursive: true, force: true }); }
}
