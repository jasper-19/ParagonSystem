import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicPageHandler } from './public-page.mjs';
import { createDiscoveryHandler } from './sitemap.mjs';

const origin = 'https://news.example';
const apiBase = 'https://api.example/api';
const request = (path, method = 'GET') => new Request(`${origin}${path}`, { method,
  headers: { authorization: 'Bearer private', cookie: 'private=session', 'x-forwarded-host': 'evil.example' } });

test('Vercel function serves robots for original and rewritten paths', async () => {
  const { GET, HEAD } = await import('../api/seo.mjs');
  const direct = await GET(request('/robots.txt'));
  const rewritten = await GET(request('/api/seo?__page=%2Frobots.txt'));
  assert.equal(rewritten.status, 200);
  assert.equal(await rewritten.text(), await direct.text());
  assert.equal(await (await HEAD(request('/api/seo?__page=%2Frobots.txt', 'HEAD'))).text(), '');
  assert.equal((await GET(request('/api/seo?__page=%2F%2Fevil.example'))).status, 404);
});

test('SSR gets canonical public request without visitor credentials, including HEAD', async () => {
  const handler = createPublicPageHandler({ siteOrigin: origin, apiBase,
    fetcher: async (url, options) => {
      assert.equal(url, `${apiBase}/articles/story/resolve`);
      assert.deepEqual(options.headers, { Accept: 'application/json' });
      assert.equal(options.redirect, 'error');
      return Response.json({ slug: 'story', redirect: false });
    }, render: async req => {
      assert.equal(req.url, `${origin}/article/story`);
      assert.equal(req.headers.get('cookie'), null);
      assert.equal(req.headers.get('authorization'), null);
      assert.equal(req.headers.get('x-forwarded-host'), null);
      return new Response('<article><h1>Story</h1><p>Public article text</p></article>');
    } });
  const response = await handler(request('/article/story'));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Public article text/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(await (await handler(request('/article/story', 'HEAD'))).text(), '');
});

test('old slugs redirect to trusted canonical target and missing content is never rendered', async () => {
  let result = { slug: 'new-story', redirect: true };
  const handler = createPublicPageHandler({ siteOrigin: origin, apiBase,
    fetcher: async () => result ? Response.json(result) : new Response(null, { status: 404 }),
    render: async () => { throw new Error('Must not render'); } });
  const redirect = await handler(request('/article/old-story?utm_source=example'));
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('location'), `${origin}/article/new-story`);
  result = null;
  const missing = await handler(request('/article/old-story'));
  assert.equal(missing.status, 404);
  assert.equal(missing.headers.get('x-robots-tag'), 'noindex');
  result = { slug: '//evil.example', redirect: true };
  assert.equal((await handler(request('/article/old-story'))).status, 503);
});

test('unknown routes, invalid slugs, unpublished issues and failures have real status codes', async () => {
  let fail = false;
  const handler = createPublicPageHandler({ siteOrigin: origin, apiBase,
    fetcher: async () => fail ? new Response(null, { status: 500 }) : Response.json({ slug: 'issue', status: 'draft' }),
    render: async () => new Response('unexpected') });
  for (const path of ['/unknown', '/article/Bad', '/article/a%2Fb', '/special-issues/issue']) {
    assert.equal((await handler(request(path))).status, 404, path);
  }
  fail = true;
  const failure = await handler(request('/article/story'));
  assert.equal(failure.status, 503);
  assert.equal(failure.headers.get('retry-after'), '60');
});

test('preview and query variants are noindex; clean routes retain SSR status', async () => {
  const render = async () => new Response('page', { headers: { 'Content-Type': 'text/html' } });
  const handler = createPublicPageHandler({ siteOrigin: origin, apiBase, render });
  assert.equal((await handler(request('/top-stories?search=term'))).headers.get('x-robots-tag'), 'noindex');
  assert.equal((await handler(request('/top-stories'))).headers.get('x-robots-tag'), null);
  assert.equal((await handler(request('/top-stories?utm_source=facebook'))).headers.get('x-robots-tag'), null);
  assert.equal((await createPublicPageHandler({ siteOrigin: origin, apiBase, render, preview: true })(request('/'))).headers.get('x-robots-tag'), 'noindex');
  assert.equal((await handler(request('/join/'))).status, 308);
});

test('sitemap index shards published URLs and omits fabricated lastmod dates', async () => {
  const handler = createDiscoveryHandler({ siteOrigin: origin, apiBase, fetcher: async url => {
    if (url.endsWith('/count')) return Response.json({ count: url.includes('/articles/') ? 1001 : 0 });
    assert.equal(url, `${apiBase}/articles/sitemap/page?page=1&limit=1000`);
    return Response.json({ items: [{ slug: 'story', publishedAt: '2026-01-01T00:00:00Z' }, { slug: 'another', modifiedAt: null }] });
  } });
  const index = await (await handler(request('/sitemap.xml'))).text();
  assert.match(index, /sitemaps\/articles\/1.xml/);
  assert.match(index, /sitemaps\/articles\/2.xml/);
  assert.doesNotMatch(index, /sitemaps\/special-issues\/1.xml/);
  const page = await (await handler(request('/sitemaps/articles/1.xml'))).text();
  assert.match(page, /https:\/\/news.example\/article\/story/);
  assert.equal((page.match(/<lastmod>/g) || []).length, 1);
  assert.doesNotMatch(page, /admin|draft|pdf/);
  const robots = await (await handler(request('/robots.txt'))).text();
  assert.match(robots, /Sitemap: https:\/\/news.example\/sitemap.xml/);
  assert.doesNotMatch(robots, /Disallow: \/admin/); // crawlers can read noindex headers
});

test('discovery fails closed on bad responses, rejects empty pages and disables preview sitemaps', async () => {
  const empty = createDiscoveryHandler({ siteOrigin: origin, apiBase, fetcher: async () => Response.json({ items: [] }) });
  assert.equal((await empty(request('/sitemaps/articles/2.xml'))).status, 404);
  const malformed = createDiscoveryHandler({ siteOrigin: origin, apiBase, fetcher: async () => Response.json({ items: [{ slug: '<script>' }] }) });
  assert.equal((await malformed(request('/sitemaps/articles/1.xml'))).status, 503);
  const preview = createDiscoveryHandler({ siteOrigin: origin, apiBase, preview: true });
  assert.equal((await preview(request('/sitemap.xml'))).status, 404);
  assert.match(await (await preview(request('/robots.txt'))).text(), /Disallow: \//);
});
