import type { RequestHandler } from 'express';
import { exactPdfBytes } from '../../storage/pdf-stream';
import { pipeline } from 'node:stream/promises';
import { getAuthToken } from '../../security/auth-token';
import { authorizeLiveAdmin } from '../../security/live-session';
import { privatePdfKey } from '../../storage/private-pdf-path';
import { privatePdfStorage } from '../../storage/storage.factory';
import type { PrivatePdfStore, PdfByteRange } from '../../storage/private-pdf-storage';
import { findPdfForDelivery } from './special-issue.repository';

export function parsePdfRange(header: string | undefined, size: number): PdfByteRange | null {
  if (!header) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (!match[1] && !match[2])) return null;
  let start: number;
  let end: number;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return null;
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size) return null;
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

export type PdfDeliveryRecord = { status: string; size: number; sha256: string };
type Dependencies = {
  lookup(key: string): Promise<PdfDeliveryRecord | null>;
  storage: Pick<PrivatePdfStore, 'read'>;
  authorize(token: string): Promise<boolean>;
};

export function createPrivatePdfHandler(deps: Dependencies = {
  lookup: findPdfForDelivery, storage: privatePdfStorage, authorize: authorizeLiveAdmin,
}, options: { timeoutMs?: number } = {}): RequestHandler {
  let active = 0;
  const maxActive = 8;
  return async (req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, private', 'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'cross-origin' });
    let key: string;
    try { key = privatePdfKey(String(req.params['id'])); }
    catch { res.status(404).json({ error: 'PDF not found' }); return; }
    const controller = new AbortController();
    const abort = () => controller.abort();
    req.once('aborted', abort);
    res.once('close', abort);
    const deadline = setTimeout(abort, Math.min(60_000, Math.max(10, options.timeoutMs ?? 60_000)));
    deadline.unref();
    let admitted = false;
    try {
      const record = await deps.lookup(key);
      const token = getAuthToken(req)?.token;
      if (!record || (record.status !== 'published' && (!token || !await deps.authorize(token)))) {
        res.status(404).json({ error: 'PDF not found' }); return;
      }
      if (!Number.isSafeInteger(record.size) || record.size <= 0 || record.size > 100 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(record.sha256)) throw new Error('Invalid PDF metadata');
      const etag = `"${record.sha256}"`;
      // Conditional requests still pass authorization; never issue cached 304s.
      const rangeHeader = req.get('if-range') && req.get('if-range') !== etag ? undefined : req.get('range');
      const range = parsePdfRange(rangeHeader, record.size);
      if (!range) {
        res.set('Content-Range', `bytes */${record.size}`);
        res.status(416).end(); return;
      }
      const expected = range.end - range.start + 1;
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="publication.pdf"',
        'Accept-Ranges': 'bytes', 'Content-Length': String(expected), ETag: etag });
      if (rangeHeader) res.status(206).set('Content-Range', `bytes ${range.start}-${range.end}/${record.size}`);
      if (req.method === 'HEAD') { res.end(); return; }
      if (active >= maxActive) {
        res.removeHeader('Content-Length'); res.removeHeader('Content-Range');
        res.removeHeader('Content-Type');
        res.status(503).set('Retry-After', '5').json({ error: 'PDF delivery is busy' }); return;
      }
      active++; admitted = true;
      const source = await deps.storage.read(key, range, record.size, controller.signal);
      // No storage URL, token, credentials or provider headers reach the browser.
      await pipeline(source, exactPdfBytes(expected), res, { signal: controller.signal });
    } catch (error) {
      if (res.headersSent || controller.signal.aborted) res.destroy();
      else {
        res.removeHeader('Content-Length'); res.removeHeader('Content-Range');
        res.removeHeader('Content-Type');
        res.removeHeader('ETag');
        next(Object.assign(new Error('PDF delivery is unavailable'), { statusCode: 503 }));
      }
    } finally {
      if (admitted) active--;
      clearTimeout(deadline);
      req.removeListener('aborted', abort); res.removeListener('close', abort);
    }
  };
}
