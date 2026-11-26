import assert from 'node:assert/strict';
import { after, afterEach, mock, test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import db from '../../config/db';
import routes from './article.routes';
import { signAuthToken } from '../../security/auth-token';
import { errorHandler } from '../../middlewares/errorHandler';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'public-article-regression-only-secret-at-least-32';
afterEach(() => mock.restoreAll());
after(async () => { await db.end(); });

test('public slug/feed/preview/list endpoints never expose drafts, and admin editing stays protected', async () => {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  mock.method(db, 'query', async (sql: string, values: unknown[] = []) => {
    statements.push({ sql, values });
    if (sql.includes('FROM articles')) {
      const publishedFilter = /LOWER\(status::text\) = 'published'/.test(sql) ||
        (/LOWER\(status::text\) = LOWER\(\$\d+\)/.test(sql) && values.includes('Published'));
      const slug = values[0];
      const status = slug === 'public-story' || slug === 'Published' ? 'Published' : 'Draft';
      if (publishedFilter && status !== 'Published' && typeof slug === 'string' && slug !== 'Published') return { rows: [] };
      if (/WHERE slug = \$1/.test(sql)) assert.deepEqual(values, [slug]);
      return { rows: [{ id: '11111111-1111-4111-8111-111111111111', title: status === 'Draft' ? 'Private draft' : 'Published title',
        slug: typeof slug === 'string' && slug !== 'Published' ? slug : 'public-story', status,
        excerpt: 'Public introduction', content: '<p>Article body</p>', image: 'https://images.example/news.jpg',
        seo_description: 'Alternate description', language: 'fil', content_modified_at: '2026-01-01T10:00:00.000Z',
        category: 'News', author: 'Campus writer', published_at: new Date(), created_at: new Date() }] };
    }
    if (sql.includes('FROM article_credits')) return { rows: [] };
    throw new Error('Unexpected query in isolated public-read tests');
  });
  const app = express(); app.use('/articles', routes); app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/articles`;
  try {
    for (const path of ['/draft-story', '/draft-story/feed', '/draft-story/preview']) {
      const response = await fetch(base + path);
      assert.equal(response.status, 404, path);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.ok(!(await response.text()).includes('Private draft'));
    }
    const preview = await fetch(`${base}/public-story/preview`);
    assert.equal(preview.status, 200); assert.equal(preview.headers.get('cache-control'), 'no-store');
    const body = await preview.json() as Record<string, unknown>;
    assert.equal(body['title'], 'Published title');
    assert.equal(body['content'], undefined); assert.equal(body['author'], undefined);
    const feed = await fetch(base + '/public-story/feed');
    assert.equal(feed.status, 200);
    const { article } = await feed.json() as { article: Record<string, unknown> };
    assert.equal(article['status'], 'Published');
    assert.equal(article['seoDescription'], 'Alternate description');
    assert.equal(article['language'], 'fil');
    assert.equal(article['modifiedAt'], '2026-01-01T10:00:00.000Z');
    for (const status of ['Draft', 'Archived', 'Scheduled']) {
      assert.equal((await fetch(`${base}?status=${status}`)).status, 400);
    }
    await fetch(base);
    assert.ok(statements.some(entry => /LOWER\(status::text\) = LOWER\(\$\d+\)/.test(entry.sql) && entry.values.includes('Published')));
    assert.equal((await fetch(`${base}/admin/by-slug/draft-story`)).status, 401);
    const staffToken = signAuthToken({ subject: 'env-admin', role: 'staff' });
    assert.equal((await fetch(`${base}/admin/by-slug/draft-story`, { headers: { Authorization: `Bearer ${staffToken}` } })).status, 403);
    for (const [method, suffix] of [['POST', ''], ['PATCH', '/11111111-1111-4111-8111-111111111111']] as const) {
      assert.equal((await fetch(base + suffix, { method })).status, 401);
      assert.equal((await fetch(base + suffix, { method, headers: { Authorization: 'Bearer ' + staffToken } })).status, 403);
    }
    const token = signAuthToken({ subject: 'env-admin', role: 'admin' });
    const editor = await fetch(`${base}/admin/by-slug/draft-story`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(editor.status, 200);
    assert.equal(editor.headers.get('cache-control'), 'private, no-store');
    assert.equal((await editor.json() as Record<string, unknown>)['status'], 'Draft');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
