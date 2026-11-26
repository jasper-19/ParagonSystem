import { createPublicPageHandler } from '../server/public-page.mjs';
import { createDiscoveryHandler } from '../server/sitemap.mjs';
import { API_BASE, SITE_ORIGIN } from '../server/seo-http.mjs';

const options = {
  apiBase: process.env.PUBLIC_API_BASE_URL || API_BASE,
  siteOrigin: process.env.PUBLIC_SITE_URL || SITE_ORIGIN,
  preview: process.env.VERCEL_ENV === 'preview',
};
const pages = createPublicPageHandler({ ...options, render: async request => {
  const { handleRequest } = await import('../dist/ParagonWebApp/server/server.mjs');
  return handleRequest(request);
} });
const discovery = createDiscoveryHandler(options);

export function GET(request) {
  const url = new URL(request.url);
  // Some runtimes supply the rewritten function URL rather than the public URL.
  if (url.pathname === '/api/seo') {
    const routed = url.searchParams.get('__page');
    if (!routed || !routed.startsWith('/') || routed.startsWith('//') || /[?#\\]/.test(routed)) {
      return new Response(null, { status: 404, headers: { 'X-Robots-Tag': 'noindex' } });
    }
    url.pathname = routed;
  }
  url.searchParams.delete('__page');
  // Vercel may also expose the rewrite's named path capture as a query key.
  if (url.searchParams.get('page') === url.pathname.slice(1)) {
    url.searchParams.delete('page');
  }
  request = new Request(url, { method: request.method });
  const path = url.pathname;
  return path === '/robots.txt' || path === '/sitemap.xml' || path.startsWith('/sitemaps/')
    ? discovery(request) : pages(request);
}
export const HEAD = GET;
