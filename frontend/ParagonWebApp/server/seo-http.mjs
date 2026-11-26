export const SITE_ORIGIN = 'https://paragon-system-gvlg.vercel.app';
export const API_BASE = 'https://paragon-api-4zfk.onrender.com/api';
export const SITE_NAME = 'Paragon - Cagayan State University Gonzaga';
export const SLUG = /^[a-z0-9-]{1,255}$/;

export function configuredUrl(value, originOnly = false) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || (originOnly && url.pathname !== '/')) throw new Error('Invalid public URL configuration');
  return originOnly ? url.origin : url.href.replace(/\/$/, '');
}

// Public requests never forward visitor cookies, authorization, or proxy headers.
export async function publicJson(fetcher, url) {
  const response = await fetcher(url, { headers: { Accept: 'application/json' },
    redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000) });
  if (response.status === 404) return null;
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) {
    throw new Error('Public content unavailable');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new Error('Public response too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function errorResponse(status, head = false) {
  const message = status === 404 ? 'Page not found' : 'Page temporarily unavailable';
  return new Response(head ? null : `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${message} | ${SITE_NAME}</title><meta name="robots" content="noindex"></head><body><main><h1>${message}</h1><a href="/">Return to Paragon</a></main></body></html>`, {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex', ...(status === 503 ? { 'Retry-After': '60' } : {}) },
  });
}
