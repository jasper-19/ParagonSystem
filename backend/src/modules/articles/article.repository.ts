import db from "../../config/db";
import type {  PoolClient } from "pg";
import { sanitizeArticleHtml } from "../../security/sanitize-html";

export const ARTICLE_CREDIT_TYPES = [
  "author",
  "photo",
  "graphic",
  "illustration",
] as const;

export type CreateArticleRepositoryInput =
  Record<string, unknown> & {
    credits?: ArticleCreditInput[];
  };

export type ArticleCreditType = (typeof ARTICLE_CREDIT_TYPES)[number];

export type ArticleCreditInput = {
  staffId: string;
  creditedName: string
  creditType: ArticleCreditType;
};

export type ArticleCredit = ArticleCreditInput & {
  id: string;
  articleId: string;
  createdAt: Date | string;
};

/** Maps a snake_case database row to a camelCase article object. */
function mapRow(row: any) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: sanitizeArticleHtml(String(row.content ?? "")),
    image: row.image,

    author: row.author,
    photoby: row.photo_by ?? "",
    graphicby: row.graphic_by ?? "",
    // Keep the frontend/back-compat spelling (typo) for now.
    illusrationby: row.illustration_by ?? "",

    category: row.category,
    tags: row.tags ?? [],

    status: row.status,
    featured: row.featured,
    views: row.views,

    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  };
}

function mapCardRow(row: any) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    image: row.image,
    author: row.author,
    photoby: row.photo_by ?? "",
    graphicby: row.graphic_by ?? "",
    illusrationby: row.illustration_by ?? "",
    category: row.category,
    tags: row.tags ?? [],
    status: row.status,
    featured: row.featured,
    views: row.views,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  };
}

function mapAdminRow(row: any): AdminArticleSummary {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    image: row.image,
    author: row.author,
    category: row.category,
    status: row.status,
    featured: row.featured,
    views: row.views,
    createdAt: row.created_at,
    publishedAt: row.published_at ?? undefined,
  };
}

function mapCreditRow(row: any): ArticleCredit {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    staffId: String(row.staff_id),
    creditedName: row.credited_name,
    creditType: row.credit_type as ArticleCreditType,
    createdAt: row.created_at,
  };
}

async function insertArticleCredits(
  client: PoolClient,
  articleId: string,
  credits: ArticleCreditInput[]
): Promise<void> {
  if (!credits.length) {
    return;
  }

  const values: unknown[] = [];
  const placeholders: string[] = [];

  credits.forEach((credit, index) => {
    const offset = index * 4;

    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`
    );

    values.push(
      articleId,
      credit.staffId,
      credit.creditType,
      credit.creditedName.trim()
    );
  });

  await client.query(
    `INSERT INTO article_credits
      (
        article_id,
        staff_id,
        credit_type,
        credited_name
      )
     VALUES ${placeholders.join(", ")}`,
    values
  );
}

async function replaceArticleCredits(
  client: PoolClient,
  articleId: string,
  credits: ArticleCreditInput[]
): Promise<void> {
  await client.query(
    `DELETE FROM article_credits
     WHERE article_id = $1`,
    [articleId]
  );

  await insertArticleCredits(
    client,
    articleId,
    credits
  );
}

export type FindAllFilters = {
  status?: string;
  category?: string;
  featured?: boolean;
  search?: string;
  sort?: "latest" | "oldest" | "mostViewed";
  page?: number;
  limit?: number;
  tags?: string[];
};

export type AdminArticleSummary = {
  id: string;
  title: string;
  slug: string;
  image: string;
  author: string;
  category: string;
  status: string;
  featured: boolean;
  views: number;
  createdAt: Date | string;
  publishedAt?: Date | string;
};

export type PaginatedAdminArticles = {
  items: AdminArticleSummary[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

async function enforceMaxFeaturedPublished(max: number): Promise<void> {
  // Keep the newest `max` featured+published articles featured, unfeature the rest.
  // Uses created_at as "added" time.
  await db.query(
    `WITH to_unfeature AS (
      SELECT id
      FROM articles
      WHERE featured = true
        AND LOWER(status::text) = 'published'
      ORDER BY created_at DESC
      OFFSET $1
    )
    UPDATE articles
    SET featured = false
    WHERE id IN (SELECT id FROM to_unfeature)`,
    [max]
  );
}

export async function findAll(filters: FindAllFilters = {}) {
  const where: string[] = [];
  const values: any[] = [];

  const push = (sqlWithQuestionMark: string, value: any) => {
    values.push(value);
    where.push(sqlWithQuestionMark.replace("?", `$${values.length}`));
  };

  // status/category are Postgres enums in this DB, so cast to text for comparisons.
  if (filters.status) push("LOWER(status::text) = LOWER(?)", filters.status);
  if (filters.category) push("LOWER(category::text) = LOWER(?)", filters.category);
  if (typeof filters.featured === "boolean") push("featured = ?", filters.featured);

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const p = `$${values.length}`;
    where.push(`(title ILIKE ${p} OR excerpt ILIKE ${p} OR author ILIKE ${p})`);
  }

  if (filters.tags && filters.tags.length > 0) {
    values.push(filters.tags);
    const p = `$${values.length}`;
    // Any overlap with selected tags.
    where.push(`tags && ${p}::text[]`);
  }

  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? (filters.page as number) : 1;
  const limit = Number.isFinite(filters.limit) && (filters.limit as number) > 0 ? Math.min(filters.limit as number, 100) : 50;
  const offset = (page - 1) * limit;

  let orderBy = "published_at DESC NULLS LAST, created_at DESC";
  switch (filters.sort) {
    case "oldest":
      orderBy = "created_at ASC";
      break;
    case "mostViewed":
      orderBy = "views DESC NULLS LAST, created_at DESC";
      break;
    case "latest":
    default:
      orderBy = "published_at DESC NULLS LAST, created_at DESC";
      break;
  }

  values.push(limit, offset);
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await db.query(
    `SELECT *
     FROM articles
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values
  );

  return result.rows.map(mapRow);
}

export async function findAllCards(filters: FindAllFilters = {}) {
  const where: string[] = [];
  const values: any[] = [];

  const push = (sqlWithQuestionMark: string, value: any) => {
    values.push(value);
    where.push(sqlWithQuestionMark.replace("?", `$${values.length}`));
  };

  // status/category are Postgres enums in this DB, so cast to text for comparisons.
  if (filters.status) push("LOWER(status::text) = LOWER(?)", filters.status);
  if (filters.category) push("LOWER(category::text) = LOWER(?)", filters.category);
  if (typeof filters.featured === "boolean") push("featured = ?", filters.featured);

  if (filters.search) {
    values.push(`%${filters.search}%`);
    const p = `$${values.length}`;
    where.push(`(title ILIKE ${p} OR excerpt ILIKE ${p} OR author ILIKE ${p})`);
  }

  if (filters.tags && filters.tags.length > 0) {
    values.push(filters.tags);
    const p = `$${values.length}`;
    // Any overlap with selected tags.
    where.push(`tags && ${p}::text[]`);
  }

  const page = Number.isFinite(filters.page) && (filters.page as number) > 0 ? (filters.page as number) : 1;
  const limit = Number.isFinite(filters.limit) && (filters.limit as number) > 0 ? Math.min(filters.limit as number, 100) : 50;
  const offset = (page - 1) * limit;

  let orderBy = "published_at DESC NULLS LAST, created_at DESC";
  switch (filters.sort) {
    case "oldest":
      orderBy = "created_at ASC";
      break;
    case "mostViewed":
      orderBy = "views DESC NULLS LAST, created_at DESC";
      break;
    case "latest":
    default:
      orderBy = "published_at DESC NULLS LAST, created_at DESC";
      break;
  }

  values.push(limit, offset);
  const limitParam = `$${values.length - 1}`;
  const offsetParam = `$${values.length}`;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const result = await db.query(
    `SELECT
      id,
      title,
      slug,
      excerpt,
      image,
      author,
      photo_by,
      graphic_by,
      illustration_by,
      category,
      tags,
      status,
      featured,
      views,
      created_at,
      published_at
  FROM articles
     ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${limitParam}
     OFFSET ${offsetParam}`,
    values
  );

  return result.rows.map(mapCardRow);
}

export async function findAdminArticles(
  filters: FindAllFilters = {}
): Promise<PaginatedAdminArticles> {
  const where: string[] = [];
  const filterValues: unknown[] = [];

  const addCondition = (
    sqlWithPlaceholder: string,
    value: unknown
  ): void => {
    filterValues.push(value);

    where.push(
      sqlWithPlaceholder.replace(
        "?",
        `$${filterValues.length}`
      )
    );
  };

  if (filters.status) {
    addCondition(
      "LOWER(status::text) = LOWER(?)",
      filters.status
    );
  }

  if (filters.category) {
    addCondition(
      "LOWER(category::text) = LOWER(?)",
      filters.category
    );
  }

  if (
    typeof filters.featured === "boolean"
  ) {
    addCondition(
      "featured = ?",
      filters.featured
    );
  }

  if (filters.search?.trim()) {
    filterValues.push(
      `%${filters.search.trim()}%`
    );

    const searchParam =
      `$${filterValues.length}`;

    where.push(`
      (
        title ILIKE ${searchParam}
        OR slug ILIKE ${searchParam}
        OR author ILIKE ${searchParam}
        OR category::text ILIKE ${searchParam}
      )
    `);
  }

  if (
    filters.tags &&
    filters.tags.length > 0
  ) {
    filterValues.push(filters.tags);

    const tagsParam =
      `$${filterValues.length}`;

    where.push(
      `tags && ${tagsParam}::text[]`
    );
  }

  const page =
    Number.isFinite(filters.page) &&
    Number(filters.page) > 0
      ? Number(filters.page)
      : 1;

  const limit =
    Number.isFinite(filters.limit) &&
    Number(filters.limit) > 0
      ? Math.min(Number(filters.limit), 100)
      : 20;

  const offset = (page - 1) * limit;

  let orderBy =
    "published_at DESC NULLS LAST, created_at DESC";

  switch (filters.sort) {
    case "oldest":
      orderBy =
        "created_at ASC, id ASC";
      break;

    case "mostViewed":
      orderBy =
        "views DESC NULLS LAST, created_at DESC";
      break;

    case "latest":
    default:
      orderBy =
        "published_at DESC NULLS LAST, created_at DESC";
      break;
  }

  const whereSql =
    where.length > 0
      ? `WHERE ${where.join(" AND ")}`
      : "";

  /*
   * Count and list queries share the same filters,
   * but the list query receives two additional
   * parameters for LIMIT and OFFSET.
   */
  const listValues = [
    ...filterValues,
    limit,
    offset,
  ];

  const limitParam =
    `$${filterValues.length + 1}`;

  const offsetParam =
    `$${filterValues.length + 2}`;

  const [countResult, listResult] =
    await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS total
         FROM articles
         ${whereSql}`,
        filterValues
      ),

      db.query(
        `SELECT
           id,
           title,
           slug,
           image,
           author,
           category,
           status,
           featured,
           views,
           created_at,
           published_at
         FROM articles
         ${whereSql}
         ORDER BY ${orderBy}
         LIMIT ${limitParam}
         OFFSET ${offsetParam}`,
        listValues
      ),
    ]);

  const total =
    Number(countResult.rows[0]?.total ?? 0);

  return {
    items:
      listResult.rows.map(mapAdminRow),

    page,
    limit,
    total,

    totalPages:
      total === 0
        ? 0
        : Math.ceil(total / limit),
  };
}

export async function findBySlug(slug: string) {
  if (!slug) throw new Error("Missing slug");

  const result = await db.query(
    `SELECT *
     FROM articles
     WHERE slug = $1`,
    [slug]
  );

  return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
}

export async function findCreditsByArticleId(
  articleId: string
): Promise<ArticleCredit[]> {
  if (!articleId) {
    throw new Error("Missing article ID");
  }

  const result = await db.query(
    `SELECT
       id,
       article_id,
       staff_id,
       credit_type,
       credited_name,
       created_at
     FROM article_credits
     WHERE article_id = $1
     ORDER BY
       CASE credit_type
         WHEN 'author' THEN 1
         WHEN 'photo' THEN 2
         WHEN 'graphic' THEN 3
         WHEN 'illustration' THEN 4
         ELSE 5
       END,
       created_at ASC`,
    [articleId]
  );

  return result.rows.map(mapCreditRow);
}

export async function findByCategory(category: string) {
  if (!category) throw new Error("Missing category");

  const result = await db.query(
    `SELECT *
     FROM articles
     WHERE category = $1
       AND LOWER(status::text) = 'published'
     ORDER BY published_at DESC NULLS LAST, created_at DESC`,
    [category]
  );

  return result.rows.map(mapRow);
}

export async function findById(id: string) {
  if (!id) {
    throw new Error("Missing article ID");
  }

  const result = await db.query(
    `SELECT *
     FROM articles
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  if (!result.rows[0]) {
    return null;
  }

  return mapRow(result.rows[0]);
}

export async function findByIdWithCredits(id: string) {
  const article = await findById(id);

  if (!article) {
    return null;
  }

  const credits = await findCreditsByArticleId(id);

  return {
    ...article,
    credits,
  };
}

export async function create(data: unknown) {
  if (!data) {
    throw new Error("Article data is missing");
  }

  const d = data as CreateArticleRepositoryInput;
  const credits = Array.isArray(d.credits)
    ? d.credits
    : [];

  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO articles
      (
        title,
        slug,
        excerpt,
        content,
        image,
        author,
        photo_by,
        graphic_by,
        illustration_by,
        category,
        tags,
        status,
        featured,
        published_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14
      )
      RETURNING *`,
      [
        d.title,
        d.slug,
        d.excerpt,
        d.content,
        d.image,
        d.author,
        d.photoby ?? null,
        d.graphicby ?? null,
        d.illusrationby ??
          d.illustrationby ??
          null,
        d.category,
        d.tags ?? [],
        d.status,
        d.featured ?? false,
        String(d.status ?? "").toLowerCase() ===
        "published"
          ? new Date()
          : null,
      ]
    );

    const createdRow = result.rows[0];

    if (!createdRow) {
      throw new Error(
        "Article could not be created"
      );
    }

    await insertArticleCredits(
      client,
      String(createdRow.id),
      credits
    );

    await client.query("COMMIT");

    const created = mapRow(createdRow);

    if (
      created.featured &&
      String(created.status).toLowerCase() ===
        "published"
    ) {
      await enforceMaxFeaturedPublished(5);
    }

    return {
      ...created,
      credits: credits.map(credit => ({
        articleId: created.id,
        staffId: credit.staffId,
        creditedName: credit.creditedName,
        creditType: credit.creditType,
      })),
    };
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Error creating article:",
      error
    );

    throw error;
  } finally {
    client.release();
  }
}

export async function update(
  id: string,
  data: unknown
) {
  if (!id) {
    throw new Error("Missing article ID");
  }
  const d =
    data as CreateArticleRepositoryInput;
  const credits = Array.isArray(d.credits)
    ? d.credits
    : [];
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE articles
       SET
         title = $1,
         slug = $2,
         excerpt = $3,
         content = $4,
         image = $5,
         author = $6,
         photo_by = $7,
         graphic_by = $8,
         illustration_by = $9,
         category = $10,
         tags = $11,
         status = $12,
         featured = $13
       WHERE id = $14
       RETURNING *`,
      [
        d.title,
        d.slug,
        d.excerpt,
        d.content,
        d.image,
        d.author,
        d.photoby ?? null,
        d.graphicby ?? null,
        d.illusrationby ??
          d.illustrationby ??
          null,
        d.category,
        d.tags ?? [],
        d.status,
        d.featured ?? false,
        id,
      ]
    );
    const updatedRow = result.rows[0];
    if (!updatedRow) {
      throw Object.assign(
        new Error("Article not found"),
        { statusCode: 404 }
      );
    }
    await replaceArticleCredits(
      client,
      id,
      credits
    );
    await client.query("COMMIT");
    const updated = mapRow(updatedRow);
    if (
      updated.featured &&
      String(updated.status).toLowerCase() ===
        "published"
    ) {
      await enforceMaxFeaturedPublished(5);
    }
    return {
      ...updated,
      credits: await findCreditsByArticleId(id),
    };
  } catch (error) {
    await client.query("ROLLBACK");

    console.error(
      "Error updating article:",
      error
    );
    throw error;
  } finally {
    client.release();
  }
}

export async function publish(id: string) {
  if (!id) throw new Error("Missing article ID");

  try {
    const result = await db.query(
      `UPDATE articles
       SET status = 'Published',
           published_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    const published = mapRow(result.rows[0]);
    if (published.featured) {
      await enforceMaxFeaturedPublished(5);
    }
    return published;
  } catch (error) {
    console.error("Error publishing article:", error);
    throw error;
  }
}

export async function archive(id: string) {
  if (!id) throw new Error("Missing article ID");

  try {
    const result = await db.query(
      `UPDATE articles
       SET status = 'Archived'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error("Error archiving article:", error);
    throw error;
  }
}

export async function incrementViews(slug: string) {
  if (!slug) throw new Error("Missing article slug");

  try {
    await db.query(
      `UPDATE articles
       SET views = views + 1
       WHERE slug = $1`,
      [slug]
    );
  } catch (error) {
    console.error("Error incrementing article views:", error);
    throw error;
  }
}

export async function remove(id: string) {
  await db.query(`DELETE FROM articles WHERE id = $1`, [id]);
}

export async function findCategories(): Promise<string[]> {
  const result = await db.query(
    `
    SELECT DISTINCT category
    FROM articles
    WHERE LOWER(status::text) = 'published'
    ORDER BY category
    `
  );

  return result.rows.map((row) => row.category);
}

export async function findTags(): Promise<string[]> {
  const result = await db.query(
    `
    SELECT DISTINCT UNNEST(tags) AS tag
    FROM articles
    WHERE LOWER(status::text) = 'published'
    ORDER BY tag
    `
  );

    return result.rows.map(r => r.tag);
}

export async function getDashboardSummary() {
  const [
    totals,
    recent,
  ] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'published') AS published,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'draft') AS drafts,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'archived') AS archived
      FROM articles
    `),

    db.query(`
      SELECT
        id,
        title,
        slug,
        excerpt,
        image,
        author,
        photo_by,
        graphic_by,
        illustration_by,
        category,
        tags,
        status,
        featured,
        views,
        created_at,
        published_at
      FROM articles
      ORDER BY created_at DESC
      LIMIT 5
    `),
  ]);

  return {
    total: Number(totals.rows[0].total),
    published: Number(totals.rows[0].published),
    drafts: Number(totals.rows[0].drafts),
    archived: Number(totals.rows[0].archived),
    recent: recent.rows.map(mapCardRow),
  };
}

export async function getPublishedCountsByDate() {
  const result = await db.query(`
    SELECT
      published_at::date AS date,
      COUNT(*) AS count
    FROM articles
    WHERE published_at IS NOT NULL
      AND LOWER(status::text) = 'published'
    GROUP BY published_at::date
    ORDER BY date ASC
  `);

  return result.rows.map(row => ({
    date: row.date,
    count: Number(row.count),
  }));
}

export async function findBySlugWithCredits(
  slug: string
) {
  const article = await findBySlug(slug);

  if (!article) {
    return null;
  }

  const credits = await findCreditsByArticleId(
    article.id
  );

  return {
    ...article,
    credits,
  };
}
