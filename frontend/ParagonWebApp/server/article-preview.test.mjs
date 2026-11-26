import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createArticlePreviewHandler } from './article-preview.mjs';

const shell = '<!doctype html><html><head><meta charset="utf-8"><title>Old title</title><meta property="og:title" content="old"><meta name="description" content="old"><link rel="canonical" href="https://old.example/"><base href="/"><link rel="stylesheet" href="/styles-HASH.css"></head><body><app-root></app-root><script src="/main-HASH.js" type="module"></script></body></html>';
const article = { title: 'Campus news', excerpt: 'An introduction.', image: 'https://media.example/cover.jpg', slug: 'campus-news', status: 'Published', publishedAt: '2026-11-16T00:00:00Z' };
const make = (overrides = {}) => createArticlePreviewHandler({ readIndex: async () => shell,
  siteOrigin: 'https://news.example', apiBase: 'https://api.example/api',
  fetcher: async () => Response.json(article), ...overrides });

test('initial response contains article previews without JavaScript and preserves the Angular shell', async () => {
  for (const agent of ['facebookexternalhit/1.1', 'Twitterbot/1.0', 'LinkedInBot', 'WhatsApp', 'Mozilla/5.0']) {
    let calls = 0;
    const response = await make({ fetcher: async (url, options) => {
      calls++;
      assert.equal(url, 'https://api.example/api/articles/campus-news/preview');
      assert.equal(options.redirect, 'error'); assert.equal(options.cache, 'no-store');
      assert.deepEqual(options.headers, { Accept: 'application/json' });
      assert.ok(options.signal instanceof AbortSignal);
      return Response.json(article);
    } })(new Request('https://spoofed.example/article/campus-news?slug=other&utm=source#part', { headers: { 'user-agent': agent, 'x-forwarded-host': 'attacker.example', cookie: 'private=secret', authorization: 'Bearer secret' } }));
    const html = await response.text();
    assert.equal(response.status, 200); assert.equal(calls, 1);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    for (const tag of ['og:title', 'og:type', 'og:description', 'og:url', 'og:image', 'og:image:alt', 'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image', 'twitter:image:alt', 'article:published_time']) assert.ok(html.includes(`"${tag}"`));
    assert.ok(html.includes('https://news.example/article/campus-news'));
    assert.ok(html.includes('<app-root></app-root>')); assert.ok(html.includes('/main-HASH.js'));
    assert.ok(html.includes('/styles-HASH.css'));
    assert.equal(html.match(/property="og:title"/g).length, 1);
    assert.equal(html.match(/name="description"/g).length, 1);
    assert.equal(html.match(/rel="canonical"/g).length, 1);
    assert.doesNotMatch(html, /attacker\.example|spoofed\.example|utm=|private=secret|Old title/);
  }
});

test('article-controlled values cannot inject attributes, tags or scripts', async () => {
  const hostile = { ...article, title: 'News " onload="alert(1) & </title><script>alert(1)</script>',
    excerpt: 'Quotes " & <img src=x onerror="alert(1)">', image: 'https://media.example/cover.jpg?x="&y=<script>' };
  const html = await (await make({ fetcher: async () => Response.json(hostile) })(new Request('https://news.example/api/article/campus-news'))).text();
  assert.doesNotMatch(html, /<script>alert|<img src=x|content="[^"]*" onload=/);
  assert.ok(html.includes('&quot;')); assert.ok(html.includes('&amp;'));
});

test('first response includes accurate paired image dimensions, MIME type and secure URL', async () => {
  const response = await make({ fetcher: async () => Response.json({ ...article,
    image: 'https://storage.example/public/cover.webp', imageWidth: 1600, imageHeight: 840, imageType: 'image/webp',
  }) })(new Request('https://news.example/article/campus-news'));
  const html = await response.text();
  assert.equal(response.status, 200);
  for (const [property, value] of Object.entries({ 'og:image': 'https://storage.example/public/cover.webp',
    'og:image:secure_url': 'https://storage.example/public/cover.webp', 'og:image:width': '1600',
    'og:image:height': '840', 'og:image:type': 'image/webp' })) {
    assert.ok(html.includes(`property="${property}" content="${value}"`));
    assert.equal(html.split(`property="${property}"`).length - 1, 1);
    assert.ok(html.indexOf(`property="${property}"`) < html.indexOf('</head>'));
  }
});

test('unknown or invalid dimensions are never guessed for an article image', async () => {
  for (const fields of [{}, { imageWidth: 1200 }, { imageWidth: '1200', imageHeight: 630 },
    { imageWidth: -1, imageHeight: 630 }, { imageWidth: 1200.5, imageHeight: 630 },
    { imageWidth: 10000, imageHeight: 10000 }, { imageWidth: 1200, imageHeight: 630, imageType: 'text/html' }]) {
    const html = await (await make({ fetcher: async () => Response.json({ ...article, imageType: 'image/jpeg', ...fields }) })(new Request('https://news.example/article/campus-news'))).text();
    assert.doesNotMatch(html, /property="og:image:(width|height|type)"/);
  }
  const html = await (await make({ fetcher: async () => Response.json({ ...article, image: 'javascript:alert(1)',
    imageWidth: 1, imageHeight: 1, imageType: 'image/png' }) })(new Request('https://news.example/article/campus-news'))).text();
  assert.match(html, /property="og:image:width" content="1424"/);
  assert.match(html, /property="og:image:height" content="752"/);
  assert.match(html, /property="og:image:type" content="image\/jpeg"/);
});

test('only usable HTTPS image URLs are emitted, with a real fallback asset', async () => {
  for (const image of ['', 'javascript:alert(1)', 'data:image/png;base64,private', 'http://media.example/cover.jpg', 'https://127.0.0.1/private', 'https://user:pass@media.example/cover.jpg', 'https://[::1]/private']) {
    const html = await (await make({ fetcher: async () => Response.json({ ...article, image }) })(new Request('https://news.example/article/campus-news'))).text();
    assert.ok(html.includes('property="og:image" content="https://news.example/assets/paragon-social-preview.jpg"'), image);
  }
  const image = await readFile(new URL('../src/assets/paragon-social-preview.jpg', import.meta.url));
  assert.equal(image.readUInt16BE(0), 0xffd8);
});

test('replacement tokens remain literal and optional excerpts have a useful fallback', async () => {
  const title = "$& $$ $' $`";
  const html = await (await make({ fetcher: async () => Response.json({ ...article, title, excerpt: title }) })(new Request('https://news.example/article/campus-news'))).text();
  assert.ok(html.includes('$&amp; $$ $&#39; $`'));
  assert.equal(html.match(/<head>/g).length, 1);
  assert.doesNotMatch(html, /Old title/);
  for (const excerpt of [undefined, null, '']) {
    const result = await make({ fetcher: async () => Response.json({ ...article, excerpt }) })(new Request('https://news.example/article/campus-news'));
    assert.equal(result.status, 200);
    assert.match(await result.text(), /content="Read campus news and stories from Paragon - Cagayan State University Gonzaga\."/);
  }
});

test('missing and unpublished articles never emit article-specific metadata', async () => {
  for (const response of [new Response(null, { status: 404 }), ...['Draft', 'Archived', 'Scheduled', 'Rejected'].map(status => Response.json({ ...article, status }))]) {
    const result = await make({ fetcher: async () => response })(new Request('https://news.example/article/campus-news'));
    assert.equal(result.status, 404); assert.equal(result.headers.get('cache-control'), 'no-store');
    const html = await result.text();
    assert.doesNotMatch(html, /Campus news|An introduction|media\.example\/cover|article:published_time/);
    assert.match(html, /noindex/);
  }
});

test('a previously published article is not retained after unpublication', async () => {
  let published = true;
  const handler = make({ fetcher: async () => published ? Response.json(article) : new Response(null, { status: 404 }) });
  const request = () => new Request('https://news.example/article/campus-news');
  assert.equal((await handler(request())).status, 200);
  published = false;
  const result = await handler(request());
  assert.equal(result.status, 404);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await result.text(), /Campus news|An introduction/);
});

test('upstream errors, malformed/oversized payloads and failures produce generic uncached 503', async () => {
  const factories = [
    () => new Response(null, { status: 500 }), () => new Response(null, { status: 302 }),
    () => new Response('not JSON', { headers: { 'content-type': 'application/json' } }),
    () => Response.json({ ...article, excerpt: 'x'.repeat(70_000) }),
    () => Response.json({ ...article, slug: 'other-story' }),
    () => { throw new DOMException('timeout', 'TimeoutError'); },
  ];
  for (const fetcher of factories) {
    const response = await make({ fetcher })(new Request('https://news.example/article/campus-news'));
    assert.equal(response.status, 503); assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('retry-after'), '60');
    assert.match(response.headers.get('x-robots-tag'), /noindex/);
    const html = await response.text();
    assert.doesNotMatch(html, /Campus news|An introduction|media\.example\/cover/);
    assert.match(html, /<app-root/);
    assert.match(html, /main-HASH.js/);
    assert.match(html, /styles-HASH.css/);
  }
});

test('invalid metadata configuration preserves the Angular application shell', async () => {
  for (const config of [{ siteOrigin: 'http://invalid.example' }, { apiBase: 'invalid' }]) {
    const handler = make({ ...config, fetcher: async () => { throw new Error('Must not fetch'); } });
    const response = await handler(new Request('https://news.example/article/campus-news'));
    assert.equal(response.status, 503);
    const html = await response.text();
    assert.match(html, /<app-root/); assert.match(html, /main-HASH.js/);
    assert.match(html, /noindex/);
    assert.doesNotMatch(html, /Please try again shortly/);
    const head = await handler(new Request('https://news.example/article/campus-news', { method: 'HEAD' }));
    assert.equal(head.status, 503); assert.equal(await head.text(), '');
  }
});

test('shell failures return uncached noindex responses with safe diagnostics', async () => {
  const messages = [];
  const originalError = console.error;
  console.error = (...args) => messages.push(args);
  try {
    const handler = make({ readIndex: async () => {
      throw Object.assign(new Error('private path and upstream credentials'), { code: 'ENOENT' });
    } });
    for (const method of ['GET', 'HEAD']) {
      const response = await handler(new Request('https://news.example/article/campus-news', { method }));
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.match(response.headers.get('x-robots-tag'), /noindex/);
      assert.equal(response.headers.get('retry-after'), '60');
      const html = await response.text();
      assert.doesNotMatch(html, /private path|credentials|Campus news/);
      if (method === 'HEAD') assert.equal(html, '');
    }
    assert.deepEqual(messages, Array.from({ length: 2 }, () => ['[ARTICLE_PREVIEW_UNAVAILABLE]', { stage: 'shell_load', code: 'ENOENT' }]));
  } finally { console.error = originalError; }
});

test('rejects invalid paths and methods before upstream work and supports HEAD', async () => {
  let calls = 0;
  const handler = make({ fetcher: async () => { calls++; return Response.json(article); } });
  for (const path of ['/article/invalid%2Fslug', '/admin/all-articles', '/api/article/Invalid', `/article/${'a'.repeat(256)}`]) {
    assert.equal((await handler(new Request(`https://news.example${path}`))).status, 404);
  }
  assert.equal((await handler(new Request('https://news.example/article/campus-news', { method: 'POST' }))).status, 405);
  assert.equal(calls, 0);
  const head = await handler(new Request('https://news.example/article/campus-news', { method: 'HEAD' }));
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
});

test('build configuration routes article URLs to the function and bundles the built shell', async () => {
  const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.ok(config.routes.some(route => route.dest?.startsWith('/api/seo?__page=')));
  assert.equal(config.functions['api/article/*.mjs'].includeFiles, `${config.outputDirectory}/index.csr.html`);
  assert.equal(config.functions['api/article/*.mjs'].maxDuration, 15);
  const handler = await import('../api/article/[slug].mjs');
  assert.equal(typeof handler.GET, 'function'); assert.equal(typeof handler.HEAD, 'function');
});
