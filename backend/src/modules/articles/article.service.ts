import * as repository from "./article.repository";
import * as settingsService from "../settings/settings.service";
import * as EditorialBoardService from "../editorial-board/editorial-board.service";

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

type CreateArticleCreditPayload = {
  authorIds?: string[];
  photoByIds?: string[];
  graphicByIds?: string[];
  illustrationByIds?: string[];

  [key: string]: unknown;
};

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

export type AdminArticleDetail = {
  id: string;
  title: string;
  status: string;
  featured: boolean;
  views: number;
  excerpt: string;
  category: string;
  tags: string[];
  createdAt: Date | string;
  publishedAt: Date | string;
  credits: repository.ArticleCredit[];
}
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

export interface AdminArticleResponse {
  items: Awaited<ReturnType<typeof repository.findAdminArticles>>['items'];

  page: number;
  limit: number;
  total: number;
  totalPages: number;
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

function normalizeStaffIds(
  ids: unknown
): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [
    ...new Set(
      ids
        .map(id => String(id).trim())
        .filter(Boolean)
    ),
  ];
}

function creditNames(
  credits: repository.ArticleCreditInput[],
  creditType: repository.ArticleCreditType
): string {
  return credits
    .filter(
      credit => credit.creditType === creditType
    )
    .map(
      credit => credit.creditedName
    )
    .join(", ");
}

async function resolveCreditGroup(
  staffIds: string[],
  creditType: repository.ArticleCreditType
): Promise<repository.ArticleCreditInput[]> {
  if (!staffIds.length) {
    return [];
  }

  const members =
    await EditorialBoardService.resolveActiveBoardMembers(
      staffIds
    );

  /*
   * Preserve the order selected by the editor.
   */
  const memberById = new Map(
    members.map(member => [
      member.staffId,
      member,
    ])
  );

  return staffIds.map(staffId => {
    const member = memberById.get(staffId);

    if (!member) {
      throw Object.assign(
        new Error(
          "Only members of the active editorial board can be credited."
        ),
        { statusCode: 400 }
      );
    }

    return {
      staffId: member.staffId,
      creditedName: member.fullName,
      creditType,
    };
  });
}

async function prepareArticleCredits(
  data: CreateArticleCreditPayload
): Promise<repository.ArticleCreditInput[]> {
  const authorIds =
    normalizeStaffIds(data.authorIds);

  const photoByIds =
    normalizeStaffIds(data.photoByIds);

  const graphicByIds =
    normalizeStaffIds(data.graphicByIds);

  const illustrationByIds =
    normalizeStaffIds(data.illustrationByIds);

  if (!authorIds.length) {
    throw Object.assign(
      new Error(
        "At least one active editorial board member must be credited as an author."
      ),
      { statusCode: 400 }
    );
  }

  const [
    authors,
    photographers,
    graphicArtists,
    illustrators,
  ] = await Promise.all([
    resolveCreditGroup(
      authorIds,
      "author"
    ),

    resolveCreditGroup(
      photoByIds,
      "photo"
    ),

    resolveCreditGroup(
      graphicByIds,
      "graphic"
    ),

    resolveCreditGroup(
      illustrationByIds,
      "illustration"
    ),
  ]);

  return [
    ...authors,
    ...photographers,
    ...graphicArtists,
    ...illustrators,
  ];
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
      featured: featured.map(toPublicArticleCard),

      mostViewed: mostViewed.map(toPublicArticleCard),

      categories: categories.map(section => ({
        category: section.category,
        articles: section.articles.map(toPublicArticleCard),
      })),

      moreStories: moreStories.map(toPublicArticleCard),
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
    article: toPublicArticle(article),
    related: related.map(toPublicArticleCard),
    otherStories: otherStories.map(toPublicArticleCard),
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
    articles: articles.map(toPublicArticleCard),
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
    recent: recent.map(toPublicArticleCard),
    categories,
  };
}

//**Retrieve all articles optionally filtered by status */
export async function getArticles(filters: GetArticlesFilters = {}) {
    return repository.findAllCards(filters);
}

//**Retrieve admin articles */
export async function getAdminArticles(
  filters: GetArticlesFilters = {}
): Promise<AdminArticleResponse> {
  return repository.findAdminArticles(filters);
}

export async function getAdminArticleDetail(
  id: string
): Promise<AdminArticleDetail> {
  if (!id) {
    throw Object.assign(
      new Error('Article ID is required'),
      { statusCode: 400 }
    );
  }

  const article =
    await repository.findByIdWithCredits(id);

  if (!article) {
    throw Object.assign(
      new Error('Article not found'),
      { statusCode: 404 }
    );
  }

  return {
    id: article.id,
    title: article.title,
    status: article.status,
    featured: article.featured,
    views: article.views,
    excerpt: article.excerpt,
    category: article.category,
    tags: article.tags ?? [],
    createdAt: article.createdAt,
    publishedAt: article.publishedAt,
    credits: article.credits ?? [],
  };
}

/** Retrieve an article by its slug (Used for article pages) */
export async function getArticleBySlug(
  slug: string
) {
  return repository.findBySlugWithCredits(
    slug
  );
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

async function prepareArticlePayload(
  data: unknown
) {
  const articleData =
    data as CreateArticleCreditPayload;

  const credits =
    await prepareArticleCredits(articleData);

  return {
    ...articleData,

    author:
      creditNames(credits, "author"),

    photoby:
      creditNames(credits, "photo"),

    graphicby:
      creditNames(credits, "graphic"),

    illusrationby:
      creditNames(
        credits,
        "illustration"
      ),

    credits,
  };
}

/** Create a new article. */
export async function createArticle(
  data: unknown
) {
  const input = data as { status?: string; image?: string };
  const { publishingMedia } = await settingsService.getSettings();
  if (input.status === "Published" && !publishingMedia.allowDirectPublishing) {
    throw Object.assign(
      new Error("Direct publishing is disabled by the global publishing policy"),
      { statusCode: 403 }
    );
  }
  if (
    input.status === "Published" &&
    publishingMedia.requireFeaturedImage &&
    !input.image?.trim()
  ) {
    throw Object.assign(
      new Error("A cover image is required before an article can be published"),
      { statusCode: 422 }
    );
  }

  const repositoryPayload =
    await prepareArticlePayload(
      data
    );

  return repository.create(
    repositoryPayload
  );
}

/**
 * Update article content and credits.
 * Credits are revalidated against the active board.
 */
export async function updateArticle(
  id: string,
  data: unknown
) {
  const existing =
    await repository.findById(id);

  if (!existing) {
    throw Object.assign(
      new Error("Article not found"),
      { statusCode: 404 }
    );
  }

  const articleData =
    data as CreateArticleCreditPayload;
  const policyInput = articleData as CreateArticleCreditPayload & {
    status?: string;
    image?: string;
  };
  const { publishingMedia } = await settingsService.getSettings();
  const resultingStatus = policyInput.status ?? existing.status;
  const resultingImage = policyInput.image ?? existing.image;
  const requestsPublishing =
    policyInput.status === "Published" &&
    existing.status !== "Published";
  if (
    requestsPublishing &&
    !publishingMedia.allowDirectPublishing
  ) {
    throw Object.assign(
      new Error("Direct publishing is disabled by the global publishing policy"),
      { statusCode: 403 }
    );
  }
  if (
    resultingStatus === "Published" &&
    publishingMedia.requireFeaturedImage &&
    !String(resultingImage ?? "").trim() &&
    (requestsPublishing || policyInput.image !== undefined)
  ) {
    throw Object.assign(
      new Error("A cover image is required before an article can be published"),
      { statusCode: 422 }
    );
  }

  const credits =
    await prepareArticleCredits(
      articleData
    );

  const repositoryPayload = {
    ...articleData,

    /*
     * Keep legacy display fields synchronized
     * with the structured article credits.
     */
    author:
      creditNames(
        credits,
        "author"
      ),

    photoby:
      creditNames(
        credits,
        "photo"
      ),

    graphicby:
      creditNames(
        credits,
        "graphic"
      ),

    /*
     * Preserve the existing misspelled API field
     * while the frontend and repository still use it.
     */
    illusrationby:
      creditNames(
        credits,
        "illustration"
      ),

    credits,
  };

  const updated =
    await repository.update(
      id,
      repositoryPayload
    );

  return {
    article: updated,
    previousSlug: existing.slug,
    currentSlug: updated.slug,
  };
}

/**
 * Publish an article.
 * Automatically sets published_at timestamp in the repository.
 */
export async function publishArticle(id: string) {
  const [existing, { publishingMedia }] = await Promise.all([
    repository.findById(id),
    settingsService.getSettings(),
  ]);
  if (!existing) {
    throw Object.assign(new Error("Article not found"), { statusCode: 404 });
  }
  if (!publishingMedia.allowDirectPublishing) {
    throw Object.assign(
      new Error("Direct publishing is disabled by the global publishing policy"),
      { statusCode: 403 }
    );
  }
  if (
    publishingMedia.requireFeaturedImage &&
    !String(existing.image ?? "").trim()
  ) {
    throw Object.assign(
      new Error("A cover image is required before an article can be published"),
      { statusCode: 422 }
    );
  }
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
/** Convert an article to its public representation. */
function toPublicArticleCard(article: any) {
  const {
    id,
    status,
    featured,
    createdAt,
    updatedAt,
    ...publicArticle
  } = article;

  return publicArticle;
}

/** Convert an article to its public representation. */
function toPublicArticle(article: any) {
  const {
    id,
    status,
    featured,
    createdAt,
    updatedAt,
    ...publicArticle
  } = article;

  return publicArticle;
}
