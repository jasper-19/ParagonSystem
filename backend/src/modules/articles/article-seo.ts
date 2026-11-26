import { z } from 'zod';
import db from '../../config/db';
import { asyncHandler } from '../../utils/asyncHandler';

export const sitemapQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
}).strict();

export function sitemapCountHandler(kind: 'articles' | 'special_issues') {
  return asyncHandler(async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    const result = await db.query(`SELECT COUNT(*) AS count FROM ${kind} WHERE LOWER(status::text) = 'published'`);
    res.json({ count: Number(result.rows[0].count) });
  });
}

/** Bounded pagination never reads private columns. Table names are a closed internal enum. */
export function sitemapHandler(kind: 'articles' | 'special_issues') {
  return asyncHandler(async (req, res) => {
    res.set('Cache-Control', 'no-store');
    const parsed = sitemapQuerySchema.safeParse(req.query);
    if (!parsed.success) { res.status(400).json({ error: 'Invalid sitemap query' }); return; }
    const { page, limit } = parsed.data;
    const modified = kind === 'articles' ? 'content_modified_at' : 'updated_at';
    const result = await db.query(
      `SELECT id, slug, published_at, ${modified} AS modified_at FROM ${kind}
       WHERE LOWER(status::text) = 'published'
       ORDER BY id ASC LIMIT $1 OFFSET $2`, [limit + 1, (page - 1) * limit]);
    const rows = result.rows.slice(0, limit);
    res.json({ items: rows.map(row => ({ slug: row.slug,
      publishedAt: row.published_at, modifiedAt: row.modified_at ?? null })),
      page, limit, hasMore: result.rows.length > limit });
  });
}

export const resolveArticleSlug = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const slug = req.params['slug'];
  if (typeof slug !== 'string' || !/^[a-z0-9-]{1,255}$/.test(slug)) {
    res.status(404).json({ error: 'Article not found' }); return;
  }
  const result = await db.query(
    `SELECT a.slug FROM articles a
     JOIN article_slug_history h ON h.article_id = a.id
     WHERE h.slug = $1 AND LOWER(a.status::text) = 'published' LIMIT 1`, [slug]);
  const current = result.rows[0]?.slug;
  if (!current) { res.status(404).json({ error: 'Article not found' }); return; }
  res.json({ slug: current, redirect: current !== slug });
});
