import * as repository from "./article.repository";

const ALLOWED_STATUSES = [
    "Draft",
    "Published",
    "Archived"
] as const;

const HOMEPAGE_LIMITS = {
  featured: 5,
  mostViewed: 6,
  category: 3,
  moreStories: 6,
} as const;

const ARTICLE_FEED_LIMITS = {
  related: 6,
  otherStories: 8,
  queryBuffer: 20,
} as const;

const SEARCH_FEED_LIMITS = {
  recent: 5,
} as const;

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

export interface HomepageFeed {
  featured: Awaited<ReturnType<typeof repository.findAllCards>>;
  mostViewed: Awaited<ReturnType<typeof repository.findAllCards>>;
  categories: {
    category: string;
    articles: Awaited<ReturnType<typeof repository.findAllCards>>;
  }[];
  moreStories: Awaited<ReturnType<typeof repository.findAllCards>>;
}

export interface ArticleFeed {
  article: Awaited<ReturnType<typeof repository.findBySlug>>;
  related: Awaited<ReturnType<typeof repository.findAllCards>>;
  otherStories: Awaited<ReturnType<typeof repository.findAllCards>>;
}

export interface CategoryPageFeed {
  articles: Awaited<ReturnType<typeof repository.findAllCards>>;
  categories: Awaited<ReturnType<typeof repository.findCategories>>;
  tags: Awaited<ReturnType<typeof repository.findTags>>;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface SearchFeed {
  recent: Awaited<ReturnType<typeof repository.findAllCards>>;
  categories: Awaited<ReturnType<typeof repository.findCategories>>;
}

function excludeUsed<T extends { id: string }>(
  articles: T[],
  used: Set<string>
): T[] {
  return articles.filter(article => {
    if (used.has(article.id)) {
      return false;
    }

    used.add(article.id);
    return true;
  });
}

export async function getHomepageFeed(): Promise<HomepageFeed> {

    const used = new Set<string>();

    const featured = excludeUsed(
        await repository.findAllCards({
            featured: true,
            status: "Published",
            limit: HOMEPAGE_LIMITS.featured
        }),
        used
    );

    const mostViewed = excludeUsed(
        await repository.findAllCards({
            status: "Published",
            sort: "mostViewed",
            limit: HOMEPAGE_LIMITS.mostViewed
        }),
        used
    );

    const categories: HomepageFeed['categories'] = [];

    const categoryNames = await repository.findCategories();

    // Build category sections in order.
    // Earlier categories have priority when removing duplicates.
    for (const category of categoryNames) {

    const articles = excludeUsed(
        await repository.findAllCards({
        category,
        status: "Published",
        limit: HOMEPAGE_LIMITS.category,
        }),
        used
    );

    if (articles.length === 0) {
        continue;
    }

    categories.push({
        category,
        articles,
    });
    }

    const moreStories = excludeUsed(
    await repository.findAllCards({
        status: "Published",
        sort: "latest",
        limit: 50,
    }),
    used
    ).slice(0, HOMEPAGE_LIMITS.moreStories);

    return {
    featured,
    mostViewed,
    categories,
    moreStories,
    };
}

export async function getArticleFeed(
  slug: string
): Promise<ArticleFeed> {

  const article = await repository.findBySlug(slug);

  if (!article) {
    const err = Object.assign(
      new Error("Article not found"),
      { statusCode: 404 }
    );
    throw err;
  }

  const used = new Set<string>([article.id]);

  const [relatedRaw, otherRaw] = await Promise.all([
    repository.findAllCards({
      status: "Published",
      category: article.category,
      sort: "latest",
      limit: ARTICLE_FEED_LIMITS.queryBuffer,
    }),

    repository.findAllCards({
      status: "Published",
      sort: "latest",
      limit: ARTICLE_FEED_LIMITS.queryBuffer,
    }),
  ]);

  const related = excludeUsed(
    relatedRaw,
    used
  ).slice(0, ARTICLE_FEED_LIMITS.related);

  const otherStories = excludeUsed(
    otherRaw,
    used
  ).slice(0, ARTICLE_FEED_LIMITS.otherStories);

  return {
    article,
    related,
    otherStories,
  };
}

export async function getCategoryPageFeed(
  filters: GetArticlesFilters = {}
): Promise<CategoryPageFeed> {
  const page = filters.page && filters.page > 0 ? filters.page : 1;
  const limit = filters.limit && filters.limit > 0 ? filters.limit : 6;

  const articleFilters: GetArticlesFilters = {
    ...filters,
    status: "Published",
    page,
    limit,
  };

  const [articles, categories, tags] = await Promise.all([
    repository.findAllCards(articleFilters),
    repository.findCategories(),
    repository.findTags(),
  ]);

  return {
    articles,
    categories,
    tags,
    page,
    limit,
    hasMore: articles.length === limit,
  };
}

export async function getSearchFeed(): Promise<SearchFeed> {
  const [recent, categories] = await Promise.all([
    repository.findAllCards({
      status: "Published",
      sort: "latest",
      page: 1,
      limit: SEARCH_FEED_LIMITS.recent,
    }),

    repository.findCategories(),
  ]);

  return {
    recent,
    categories,
  };
}

//**Retrieve all articles optionally filtered by status */
export async function getArticles(filters: GetArticlesFilters = {}) {
    return repository.findAllCards(filters);
}


/** Retrieve an article by its slug (Used for article pages) */
export async function getArticleBySlug(slug: string) {
    return repository.findBySlug(slug);
}

/**Retrieve Article by category (public category pages) */
export async function getArticlesByCategory(category: string) {
    return repository.findByCategory(category);
}

//**Retrieve Categories */
export async function getCategories() {
    return repository.findCategories();
}


//**Retrieve Tags */
export async function getTags() {
    return repository.findTags();
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
