import { API_BASE, SITE_ORIGIN, SLUG, configuredUrl, publicJson, errorResponse } from './seo-http.mjs';

const publicPaths = new Set(['/', '/top-stories', '/special-issues', '/editorial-board', '/join',
  '/our-story', '/contact-us', '/ethics-policy', '/privacy-policy', '/terms-of-service']);
// These pages are usable previews; indexing waits for editorial approval of their wording.
const draftPolicyPaths = new Set(['/ethics-policy', '/privacy-policy', '/terms-of-service']);

export function createPublicPageHandler({ render, fetcher = fetch, siteOrigin = SITE_ORIGIN, apiBase = API_BASE,
  preview = false } = {}) {
  return async request => {
    const head = request.method === 'HEAD';
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD' } });
    try {
      const origin = configuredUrl(siteOrigin, true);
      const api = configuredUrl(apiBase);
      const incoming = new URL(request.url);
      const path = incoming.pathname.replace(/\/$/, '') || '/';
      const article = path.match(/^\/article\/([^/]+)$/);
      const issue = path.match(/^\/special-issues\/([^/]+)$/);
      if (!publicPaths.has(path) && !article && !issue) return errorResponse(404, head);
      if (article || issue) {
        const slug = (article || issue)[1];
        if (slug.length > 255 || !SLUG.test(slug)) return errorResponse(404, head);
        if (article) {
          const result = await publicJson(fetcher, `${api}/articles/${slug}/resolve`);
          if (!result) return errorResponse(404, head);
          if (typeof result.slug !== 'string' || result.slug.length > 255 || !SLUG.test(result.slug)
            || typeof result.redirect !== 'boolean') throw new Error('Invalid resolution');
          if (result.redirect || result.slug !== slug) return new Response(null, { status: 308,
            headers: { Location: `${origin}/article/${result.slug}`, 'Cache-Control': 'no-store' } });
        } else {
          const result = await publicJson(fetcher, `${api}/special-issues/${slug}`);
          if (!result || String(result.status).toLowerCase() !== 'published') return errorResponse(404, head);
          if (result.slug !== slug) throw new Error('Invalid issue');
        }
      }
      if (incoming.pathname !== path) return new Response(null, { status: 308,
        headers: { Location: `${origin}${path}${incoming.search}`, 'Cache-Control': 'no-store' } });
      // Render the same public document for users and crawlers on the trusted origin.
      const response = await render(new Request(`${origin}${path}${incoming.search}`, { headers: { Accept: 'text/html' } }));
      if (!response) return errorResponse(404, head);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Content-Type-Options', 'nosniff');
      const filtered = [...incoming.searchParams.keys()].some(key => !/^(utm_.+|fbclid|gclid)$/i.test(key));
      if (preview || filtered || draftPolicyPaths.has(path) || response.status >= 400) headers.set('X-Robots-Tag', 'noindex');
      return new Response(head ? null : response.body, { status: response.status, headers });
    } catch {
      console.error('[PUBLIC_PAGE_UNAVAILABLE]');
      return errorResponse(503, head);
    }
  };
}
