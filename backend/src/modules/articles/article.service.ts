import * as repository from "./article.repository";

const ALLOWED_STATUSES = [
    "Draft",
    "Published",
    "Archived"
] as const;

type ArticleStatus = (typeof ALLOWED_STATUSES)[number];

export type GetArticlesFilters = {
    status?: string;
    category?: string;
    featured?: boolean;
    search?: string;
    sort?: "latest" | "oldest" | "mostViewed";
    page?: number;
    limit?: number;
    tags?: string[];
};

//**Retrieve all articles optionally filtered by status */

export async function getArticles(filters: GetArticlesFilters = {}) {
    return repository.findAll(filters);
}

/** Retrieve an article by its slug (Used for article pages) */
export async function getArticleBySlug(slug: string) {
    return repository.findBySlug(slug);
}

/**Retrieve Article by category (public category pages) */
export async function getArticlesByCategory(category: string) {
    return repository.findByCategory(category);
}

/** Create a new article. */
export async function createArticle(data: unknown) {
    return repository.create(data);
}

/**
 *  Update Article Content.
 * Used by the admin editor.
 */
 export async function updateArticle(id: string, data: unknown) {
    return repository.update(id, data);
}

/**
 * Publish an article.
 * Automatically sets published_at timestamp in the repository.
 */
export async function publishArticle(id: string) {
    return repository.publish(id);
}

/**
 * Archive an article
 * Archived articles no longer appear publicly but remain in the database for record-keeping.
 */
export async function archiveArticle(id: string) {
    return repository.archive(id);
}

/** Update article status with validation. 
 * Adds defense-in-depth validation to ensure only allowed statuses are set, even if the repository layer is bypassed.
*/
export async function updateArticleStatus(id: string, status: string) {

    if (!ALLOWED_STATUSES.includes(status as ArticleStatus)) {
        const err = Object.assign
        (new Error("Invalid status value"), 
        { statusCode: 400 }
    );
        throw err;
    }
    
    if (status === "Published") {
        return repository.publish(id);
    }

    if (status === "Archived") {
        return repository.archive(id); 
    }
    return repository.update(id, { status });
}

/** Increment article view count (called when article page loads). */
export async function incrementArticleViews(slug: string) {
    return repository.incrementViews(slug);
}

/** Delete article permanently (admin action). */
export async function deleteArticle(id: string) {
    return repository.remove(id);
}
