export const DEFAULT_SITE_ORIGIN = 'https://paragon-system-gvlg.vercel.app';
export const DEFAULT_API_BASE = 'https://paragon-api-4zfk.onrender.com/api';
const SITE_NAME = 'Paragon Campus Press';
const FALLBACK_IMAGE = '/assets/paragon-social-preview.jpg';
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

function plainText(value, maxLength) {
  return String(value ?? '').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim().slice(0, maxLength);
}

function httpsUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    // These URLs are emitted as metadata, never fetched by this server.
    if (!host.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
      || host.startsWith('[') || host.endsWith('.local') || host.endsWith('.internal')) return null;
    return url;
  } catch { return null; }
}

function renderHead(shell, metadata, noindex) {
  const match = shell.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i);
  if (!match) throw new Error('Missing document head');
  // Only the trusted build shell is processed by this regex. Article values are escaped below.
  const head = match[1].replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|robots|og:[^"']*|twitter:[^"']*|article:[^"']*)["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel\s*=\s*["']canonical["'][^>]*>/gi, '');
  const tags = Object.entries(metadata.tags).map(([key, value]) =>
    `<meta ${key.startsWith('og:') || key.startsWith('article:') ? 'property' : 'name'}="${key}" content="${escapeHtml(value)}">`).join('\n');
  return shell.replace(match[0], () => `<head>${head}\n<title>${escapeHtml(metadata.title)}</title>\n${tags}\n`
    + `<link rel="canonical" href="${escapeHtml(metadata.url)}">\n`
    + (noindex ? '<meta name="robots" content="noindex, nofollow">\n' : '') + '</head>');
}

function metadataFor(article, origin, slug, status) {
  const fallback = new URL(FALLBACK_IMAGE, origin).href;
  const title = article ? plainText(article.title, 255) : status === 404 ? 'Article unavailable' : 'Article temporarily unavailable';
  const description = (article ? plainText(article.excerpt, 200) : '') || 'Read campus news and stories from Paragon Campus Press.';
  const url = new URL(`/article/${slug}`, origin).href;
  const image = article && typeof article.image === 'string' && article.image.trim()
    ? httpsUrl(article.image.trim(), origin)?.href ?? fallback : fallback;
  const tags = {
    description, 'og:type': article ? 'article' : 'website', 'og:site_name': SITE_NAME,
    'og:title': title, 'og:description': description, 'og:url': url, 'og:image': image,
    'og:image:alt': article ? title : SITE_NAME, 'twitter:card': 'summary_large_image',
    'twitter:title': title, 'twitter:description': description, 'twitter:image': image, 'twitter:image:alt': article ? title : SITE_NAME,
  };
  if (article?.publishedAt && !Number.isNaN(Date.parse(article.publishedAt))) {
    tags['article:published_time'] = new Date(article.publishedAt).toISOString();
  }
  return { title: `${title} | ${SITE_NAME}`, url, tags };
}

async function limitedJson(response) {
  if (!response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error('Invalid preview response');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 64 * 1024) { await reader.cancel(); throw new Error('Preview response too large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Server-rendered metadata only. Angular continues rendering the application in the browser. */
export function createArticlePreviewHandler({ readIndex, fetcher = fetch,
  siteOrigin = DEFAULT_SITE_ORIGIN, apiBase = DEFAULT_API_BASE } = {}) {
  return async request => {
    const headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff' };
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, HEAD' } });
    const path = new URL(request.url).pathname;
    const slug = path.match(/^\/(?:article|api\/article)\/([a-z0-9-]{1,255})\/?$/)?.[1];
    if (!slug) return new Response('Article not found', { status: 404, headers: { ...headers, 'X-Robots-Tag': 'noindex' } });
    let shell;
    let origin;
    let article = null;
    let status = 200;
    try {
      origin = httpsUrl(siteOrigin);
      const upstream = httpsUrl(apiBase);
      if (!origin || origin.pathname !== '/' || origin.search || origin.hash || !upstream || upstream.search || upstream.hash) throw new Error('Invalid preview configuration');
      origin = origin.origin;
      shell = await readIndex();
      const response = await fetcher(`${upstream.href.replace(/\/$/, '')}/articles/${slug}/preview`, {
        headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000),
      });
      if (response.status === 404) status = 404;
      else if (!response.ok) throw new Error('Preview upstream unavailable');
      else {
        const candidate = await limitedJson(response);
        if (!candidate || candidate.status?.toLowerCase() !== 'published') status = 404;
        else if (candidate.slug !== slug || typeof candidate.title !== 'string' || !candidate.title.trim()
          || (candidate.excerpt != null && typeof candidate.excerpt !== 'string')) throw new Error('Invalid preview payload');
        else article = candidate;
      }
      const html = renderHead(shell, metadataFor(article, origin, slug, status), status !== 200);
      if (status !== 200) headers['X-Robots-Tag'] = 'noindex, nofollow';
      return new Response(request.method === 'HEAD' ? null : html, { status, headers });
    } catch {
      // No raw upstream responses, article content, cookies or credentials in diagnostics.
      console.error('[ARTICLE_PREVIEW_UNAVAILABLE]');
      headers['X-Robots-Tag'] = 'noindex, nofollow';
      headers['Retry-After'] = '60';
      const safeOrigin = origin && typeof origin === 'string' ? origin : DEFAULT_SITE_ORIGIN;
      let html = '<!doctype html><html lang="en"><head><title>Article temporarily unavailable</title></head><body>Please try again shortly.</body></html>';
      try { if (shell) html = renderHead(shell, metadataFor(null, safeOrigin, slug, 503), true); } catch { /* retain generic 503 */ }
      return new Response(request.method === 'HEAD' ? null : html, { status: 503, headers });
    }
  };
}
