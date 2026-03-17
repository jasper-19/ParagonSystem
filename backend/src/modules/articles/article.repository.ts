import db from "../../config/db";

/** Maps a snake_case database row to a camelCase article object. */
function mapRow(row: any) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    content: row.content,
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

export async function create(data: unknown) {
  if (!data) throw new Error("Article data is missing");

  const d = data as Record<string, unknown>;

  try {
    const result = await db.query(
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
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
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
        (d.illusrationby ?? (d as any).illustrationby) ?? null,
        d.category,
        d.tags ?? [],
        d.status,
        d.featured ?? false,
        String(d.status ?? "").toLowerCase() === "published" ? new Date() : null,
      ]
    );
    const created = mapRow(result.rows[0]);
    if (created.featured && String(created.status).toLowerCase() === "published") {
      await enforceMaxFeaturedPublished(5);
    }
    return created;
  } catch (error) {
    console.error("Error creating article:", error);
    throw error;
  }
}

export async function update(id: string, data: unknown) {
  if (!id) throw new Error("Missing article ID");

  const d = data as Record<string, unknown>;

  try {
    const result = await db.query(
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
        (d.illusrationby ?? (d as any).illustrationby) ?? null,
        d.category,
        d.tags ?? [],
        d.status,
        d.featured ?? false,
        id,
      ]
    );
    const updated = mapRow(result.rows[0]);
    if (updated.featured && String(updated.status).toLowerCase() === "published") {
      await enforceMaxFeaturedPublished(5);
    }
    return updated;
  } catch (error) {
    console.error("Error updating article:", error);
    throw error;
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
