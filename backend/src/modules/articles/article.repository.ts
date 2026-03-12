import db from "../../config/db"

    /** Mpas a snake_case database row to a camelCase article object. */
    function mapRow(row: any) {
        return {
            id: row.id,
            title: row.title,
            slug: row.slug,
            excerpt: row.excerpt,
            content: row.content,
            image: row.image,

            author: row.author,
            photoby: row.photo_by ?? undefined,
            graphicby: row.graphic_by ?? undefined,
            illustrationby: row.illustration_by ?? undefined,

            category: row.category,
            tags: row.tags ?? [],

            status: row.status,
            featured: row.featured,
            views: row.views,

            createdAt: row.created_at,
            publishedAt: row.published_at ?? undefined
        };
    }

    export async function findAll(status?: string) {

        if (status) {
            const result =  await db.query(
                `SELECT * 
                FROM articles
                WHERE status = $1
                `,
                [status]
            );
            return result.rows.map(mapRow);
        }
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
            AND status = 'published'
            ORDER BY published_at DESC`,
            [category]
        );
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
                    featured
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
                    d.illustrationby ?? null,
                    d.category,
                    d.tags ?? [],
                    d.status,
                    d.featured ?? false
                ]
            );
            return mapRow(result.rows[0]);
        } catch (error) {
            console.error("Error creating article:", error);
            throw error;
        }
    }

export async function update(id: number, data: unknown) {

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
                d.illustrationby ?? null,
                d.category,
                d.tags ?? [],
                d.status,
                d.featured ?? false,
                id
            ]
        );
        return mapRow(result.rows[0]);

    } catch (error) {
        console.error("Error updating article:", error);
        throw error;
    }
}

export async function publish(id: number) {

    if (!id) throw new Error("Missing article ID");

    try {
        const result = await db.query(
            `UPDATE articles
            SET status = 'published',
                published_at = NOW()
            WHERE id = $1
            RETURNING *`,
            [id]
        );

        return mapRow(result.rows[0]);

} catch (error) {
        console.error("Error publishing article:", error);
        throw error;
    }
}

export async function archive(id: number) {
    
    if (!id) throw new Error("Missing article ID");

    try {
        const result = await db.query(
            `UPDATE articles
            SET status = 'archived'
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
        const result = await db.query(
            `UPDATE articles
            SET views = views + 1
            WHERE slug = $1
            RETURNING *`,
            [slug]
        );

    } catch (error) {
        console.error("Error incrementing article views:", error);
        throw error;
    }
}

export async function remove(id: number) {
    await db.query(`DELETE FROM articles WHERE id = $1`, [id]);
}