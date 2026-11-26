import { API_BASE, SITE_ORIGIN, SLUG, configuredUrl, publicJson, errorResponse } from './seo-http.mjs';

const PAGE_SIZE = 1000;
const escapeXml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const envelope = (type, body) => `<?xml version="1.0" encoding="UTF-8"?><${type} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</${type}>`;
// Unapproved policy drafts are served as previews but are not discoverable through the sitemap.
const staticPaths = ['/', '/top-stories', '/special-issues', '/editorial-board', '/join', '/our-story', '/contact-us'];

export function createDiscoveryHandler({ fetcher = fetch, siteOrigin = SITE_ORIGIN, apiBase = API_BASE, preview = false } = {}) {
  return async request => {
    const head = request.method === 'HEAD';
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    try {
      const origin = configuredUrl(siteOrigin, true);
      const api = configuredUrl(apiBase);
      const path = new URL(request.url).pathname;
      let body;
      let contentType = 'application/xml; charset=utf-8';
      if (path === '/robots.txt') {
        contentType = 'text/plain; charset=utf-8';
        body = preview ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`;
      } else if (preview) return errorResponse(404, head);
      else if (path === '/sitemap.xml') {
        const counts = await Promise.all(['articles', 'special-issues'].map(async kind => {
          const result = await publicJson(fetcher, `${api}/${kind}/sitemap/count`);
          if (!Number.isSafeInteger(result?.count) || result.count < 0 || result.count > 20_000_000) throw new Error('Invalid sitemap count');
          return { kind, pages: Math.ceil(result.count / PAGE_SIZE) };
        }));
        const urls = [`${origin}/sitemaps/pages.xml`];
        for (const { kind, pages } of counts) for (let page = 1; page <= pages; page++) urls.push(`${origin}/sitemaps/${kind}/${page}.xml`);
        body = envelope('sitemapindex', urls.map(url => `<sitemap><loc>${escapeXml(url)}</loc></sitemap>`).join(''));
      } else if (path === '/sitemaps/pages.xml') {
        body = envelope('urlset', staticPaths.map(path => `<url><loc>${escapeXml(origin + path)}</loc></url>`).join(''));
      } else {
        const match = path.match(/^\/sitemaps\/(articles|special-issues)\/([1-9][0-9]{0,4})\.xml$/);
        if (!match) return errorResponse(404, head);
        const [, kind, page] = match;
        const result = await publicJson(fetcher, `${api}/${kind}/sitemap/page?page=${page}&limit=${PAGE_SIZE}`);
        if (!Array.isArray(result?.items) || result.items.length > PAGE_SIZE) throw new Error('Invalid sitemap page');
        if (!result.items.length) return errorResponse(404, head);
        body = envelope('urlset', result.items.map(item => {
          if (typeof item.slug !== 'string' || item.slug.length > 255 || !SLUG.test(item.slug)) throw new Error('Invalid sitemap slug');
          const date = item.modifiedAt || item.publishedAt;
          const lastmod = date && !Number.isNaN(Date.parse(date)) ? `<lastmod>${new Date(date).toISOString()}</lastmod>` : '';
          return `<url><loc>${escapeXml(`${origin}/${kind === 'articles' ? 'article' : kind}/${item.slug}`)}</loc>${lastmod}</url>`;
        }).join(''));
      }
      if (Buffer.byteLength(body) > 4_000_000) throw new Error('Sitemap response too large');
      return new Response(head ? null : body, { headers: { 'Content-Type': contentType,
        'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex' } });
    } catch {
      console.error('[DISCOVERY_UNAVAILABLE]');
      return errorResponse(503, head);
    }
  };
}
