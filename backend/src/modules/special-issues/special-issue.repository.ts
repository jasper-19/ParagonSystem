import db from "../../config/db";

/** Map DB row -> API response object */
function mapRow(row: any) {
  return {
    id: String(row.id),
    title: row.title,
    slug: row.slug,
    type: row.type,
    academicYear: row.academic_year,
    description: row.description ?? undefined,
    coverImage: row.cover_image,
    pdfUrl: row.pdf_url,
    status: row.status,
    publishedAt: row.published_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
  };
}

export async function findAll(status?: string) {

  if (status) {
    const result = await db.query(
      `SELECT * FROM special_issues
       WHERE status  = $1
       ORDER BY published_at DESC`,
      [status]
    );

    return result.rows.map(mapRow);
  }

  const result = await db.query(
    `SELECT * FROM special_issues
     ORDER BY published_at DESC`
  );

  return result.rows.map(mapRow);
}

export async function findBySlug(slug: string) {

  const result = await db.query(
    `SELECT * FROM special_issues
     WHERE slug = $1`,
    [slug]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function findByType(type: string) {

  const result = await db.query(
    `SELECT * FROM special_issues
     WHERE type = $1
       AND status = 'published'
     ORDER BY published_at DESC`,
    [type]
  );

  return result.rows.map(mapRow);
}

export async function create(data: unknown) {

  if (!data) {
    throw new Error("Issue data is missing");
  }

  const d = data as Record<string, unknown>;
  const status = String(d.status ?? "");

  const publishedAtRaw = d.publishedAt;
  const publishedAt =
    typeof publishedAtRaw === "string" && publishedAtRaw.trim() !== ""
      ? new Date(publishedAtRaw)
      : status === "published"
        ? new Date()
        : null;

  try {
    const result = await db.query(
      `INSERT INTO special_issues
      (
        title,
        slug,
        type,
        academic_year,
        description,
        cover_image,
        pdf_url,
        status,
        published_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        d.title,
        d.slug,
        d.type,
        d.academicYear,
        d.description === "" ? null : (d.description ?? null),
        d.coverImage,
        d.pdfUrl,
        d.status,
        publishedAt,
      ]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error("Error creating special issue:", error);
    throw error;
  }
}

export async function update(id: string, data: unknown) {

  if (!id) throw new Error("Missing issue ID");
  if (!data) throw new Error("Issue update data is missing");

  const d = data as Record<string, unknown>;

  const set: string[] = [];
  const values: any[] = [];

  const push = (column: string, value: any) => {
    values.push(value);
    set.push(`${column} = $${values.length}`);
  };

  if ("title" in d) push("title", d.title);
  if ("slug" in d) push("slug", d.slug);
  if ("type" in d) push("type", d.type);
  if ("academicYear" in d) push("academic_year", d.academicYear);
  if ("description" in d) push("description", d.description === "" ? null : (d.description ?? null));
  if ("coverImage" in d) push("cover_image", d.coverImage);
  if ("pdfUrl" in d) push("pdf_url", d.pdfUrl);
  if ("status" in d) push("status", d.status);

  if ("publishedAt" in d) {
    const publishedAtRaw = d.publishedAt;
    const publishedAt =
      typeof publishedAtRaw === "string" && publishedAtRaw.trim() !== "" ? new Date(publishedAtRaw) : null;
    push("published_at", publishedAt);
  }

  if (set.length === 0) {
    throw Object.assign(new Error("No valid fields provided for update"), { statusCode: 400 });
  }

  try {
    const result = await db.query(
      `UPDATE special_issues
       SET ${set.join(", ")}, updated_at = NOW()
       WHERE id = $${values.length + 1}
       RETURNING *`,
      [...values, id]
    );

    if (result.rows.length === 0) {
      throw Object.assign(new Error("Issue not found"), { statusCode: 404 });
    }

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error("Error updating special issue:", error);
    throw error;
  }
}

export async function remove(id: string) {
  await db.query(`DELETE FROM special_issues WHERE id = $1`, [id]);
}
