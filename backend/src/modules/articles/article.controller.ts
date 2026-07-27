import { Request, Response, } from "express";
import * as service from "./article.service"
import * as notificationService from "../notifications/notification.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";
import { emitArticlesUpdated, emitMediaUpdated } from "../../realtime/socket.events";
import { adminArticlesQuerySchema } from "./article.schema";

function setPublicCache(res: Response): void {
    res.set({
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    });
}

/** GET /api/articles?status=<value> */
export const getArticles =  asyncHandler(
    async (req: Request, res: Response) => {

        const rawStatus = req.query["status"];
        const rawCategory = req.query["category"];
        const rawFeatured = req.query["featured"];
        const rawSearch = req.query["search"];
        const rawSort = req.query["sort"];
        const rawPage = req.query["page"];
        const rawLimit = req.query["limit"];
        const rawTags = req.query["tags"];

        const status =
            typeof rawStatus === "string"
            ? String(sanitizeValue(rawStatus))
            : undefined;

        const category =
            typeof rawCategory === "string"
            ? String(sanitizeValue(rawCategory))
            : undefined;

        const featured =
            typeof rawFeatured === "string"
            ? String(sanitizeValue(rawFeatured)) === "true"
            : undefined;

        const search =
            typeof rawSearch === "string"
            ? String(sanitizeValue(rawSearch))
            : undefined;

        const sortRaw =
            typeof rawSort === "string"
            ? String(sanitizeValue(rawSort))
            : undefined;

        const sort =
            sortRaw === "latest" || sortRaw === "oldest" || sortRaw === "mostViewed"
            ? sortRaw
            : undefined;

        const page =
            typeof rawPage === "string" && rawPage.trim() !== ""
            ? Number(String(sanitizeValue(rawPage)))
            : undefined;

        const limit =
            typeof rawLimit === "string" && rawLimit.trim() !== ""
            ? Number(String(sanitizeValue(rawLimit)))
            : undefined;

        const tags = Array.isArray(rawTags)
            ? rawTags.map((t: unknown) => String(sanitizeValue(String(t)))).filter(Boolean)
            : typeof rawTags === "string"
            ? String(sanitizeValue(rawTags))
                .split(",")
                .map((t) => t.trim())
                .filter(Boolean)
            : undefined;

        const filters: service.GetArticlesFilters = {};
        if (status !== undefined) filters.status = status;
        if (category !== undefined) filters.category = category;
        if (featured !== undefined) filters.featured = featured;
        if (search !== undefined) filters.search = search;
        if (sort !== undefined) filters.sort = sort;
        if (page !== undefined) filters.page = page;
        if (limit !== undefined) filters.limit = limit;
        if (tags !== undefined) filters.tags = tags;

        const articles = await service.getArticles(filters);
        
        setPublicCache(res);
        res.json(articles);
    }
);

/**
 * GET /api/articles/admin
 *
 * Lightweight paginated article list for the
 * All Articles admin page.
 */
export const getAdminArticles = asyncHandler(
  async (req: Request, res: Response) => {
    const parsed = adminArticlesQuerySchema.safeParse(req.query);

    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid article list query",
        details: parsed.error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    const {
      page,
      limit,
      sort,
      status,
      category,
      featured,
      search,
      tags,
    } = parsed.data;

    const filters: service.GetArticlesFilters = {
      page,
      limit,
      sort,
    };

    if (status !== undefined) filters.status = status;
    if (category !== undefined) filters.category = category;
    if (featured !== undefined) filters.featured = featured;
    if (search) filters.search = search;
    if (tags?.length) filters.tags = tags;

    const result = await service.getAdminArticles(filters);

    /*
     * This is authenticated admin data.
     * Do not allow browsers or shared proxies
     * to retain stale copies.
     */
    res.set(
      "Cache-Control",
      "private, no-store"
    );

    res.status(200).json(result);
  }
);

/**
 * GET /api/articles/admin/:id
 *
 * Lightweight article detail for the
 * admin Article View Modal.
 */
export const getAdminArticleDetail = asyncHandler(
  async (req: Request, res: Response) => {
    const id = String(
      sanitizeValue(
        req.params["id"]
      )
    ).trim();

    if (!id) {
      res.status(400).json({
        error: "Article ID is required",
      });
      return;
    }

    const article =
      await service.getAdminArticleDetail(
        id
      );

    res.set(
      "Cache-Control",
      "private, no-store"
    );

    res.status(200).json(article);
  }
);

/** GET /api/articles/homepage-feed */
export const getHomepageFeed = asyncHandler(
  async (_req: Request, res: Response) => {
    const homepageFeed = await service.getHomepageFeed();
    setPublicCache(res);
    res.json(homepageFeed);
  }
);

/** GET /api/articles/category-feed */
export const getCategoryPageFeed = asyncHandler(
  async (req: Request, res: Response) => {
    const rawCategory = req.query["category"];
    const rawSearch = req.query["search"];
    const rawSort = req.query["sort"];
    const rawPage = req.query["page"];
    const rawLimit = req.query["limit"];
    const rawTags = req.query["tags"];

    const category =
      typeof rawCategory === "string"
        ? String(sanitizeValue(rawCategory))
        : undefined;

    const search =
      typeof rawSearch === "string"
        ? String(sanitizeValue(rawSearch))
        : undefined;

    const sortRaw =
      typeof rawSort === "string"
        ? String(sanitizeValue(rawSort))
        : undefined;

    const sort =
      sortRaw === "latest" || sortRaw === "oldest" || sortRaw === "mostViewed"
        ? sortRaw
        : undefined;

    const page =
      typeof rawPage === "string" && rawPage.trim() !== ""
        ? Number(String(sanitizeValue(rawPage)))
        : undefined;

    const limit =
      typeof rawLimit === "string" && rawLimit.trim() !== ""
        ? Number(String(sanitizeValue(rawLimit)))
        : undefined;

    const tags = Array.isArray(rawTags)
      ? rawTags.map((t: unknown) => String(sanitizeValue(String(t)))).filter(Boolean)
      : typeof rawTags === "string"
      ? String(sanitizeValue(rawTags))
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      : undefined;

    const filters: service.GetArticlesFilters = {};

    if (category !== undefined) filters.category = category;
    if (search !== undefined) filters.search = search;
    if (sort !== undefined) filters.sort = sort;
    if (page !== undefined) filters.page = page;
    if (limit !== undefined) filters.limit = limit;
    if (tags !== undefined) filters.tags = tags;

    const categoryFeed = await service.getCategoryPageFeed(filters);

    setPublicCache(res);
    res.json(categoryFeed);
  }
);

/** GET /api/articles/search-feed */
export const getSearchFeed = asyncHandler(
  async (_req: Request, res: Response) => {
    const searchFeed = await service.getSearchFeed();

    setPublicCache(res);

    res.json(searchFeed);
  }
);

/** GET /api/articles/:slug/feed */
export const getArticleFeed = asyncHandler(
  async (req: Request, res: Response) => {

    const slug = sanitizeValue(req.params["slug"]) as string;

    const articleFeed = await service.getArticleFeed(slug);

    setPublicCache(res);

    res.json(articleFeed);
  }
);

/** GET /api/articles/:slug */
export const getArticleBySlug = asyncHandler(
    async (req: Request, res: Response) => {

        const slug = sanitizeValue(req.params["slug"]) as string;

        const article =  await service.getArticleBySlug(slug);

        if (!article) {
            res.status(404).json({ message: "Article not found" });
            return;
        }
        setPublicCache(res);
        res.json(article);
    }
);

/** GET /api/articles/category/:category */
export const getArticlesByCategory = asyncHandler(
    async (req: Request, res: Response) =>  {

        const category =  sanitizeValue(req.params["category"]) as string;

        const articles = await service.getArticlesByCategory(category);

        setPublicCache(res);
        res.json(articles);
    }
);

//** GET /api/articles/categories */
export const getCategories = asyncHandler(
    async (_req: Request, res: Response) => {
        res.json(await service.getCategories());
    }
);

/** GET /api/articles/tags */   
export const getTags = asyncHandler(
    async (_req: Request, res: Response) => {
        res.json(await service.getTags());
    }
);

/** POST /api/articles  - body validated by Zod middleware*/
export const createArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const article = await service.createArticle(req.body);

        notificationService.createForEvent(
            "articleCreated",
            `New Article created: ${(article as any).title ?? "Untitled"}.`,
            "article"
        ).catch(() => {});
        auditLog(
            req,
            "CREATE",
            "ARTICLES",
            `Created article: ${(article as any).title ?? "Untitled"}`,
            {
                resourceId: String((article as any).id ?? ""),
                details: { title: (article as any).title, slug: (article as any).slug },
            }
        );
        emitArticlesUpdated();
        emitMediaUpdated();

        res.status(201).json(article);
    }
);

/** PATCH /api/articles/:id */
export const updateArticle = asyncHandler(
  async (req: Request, res: Response) => {

    const id = sanitizeValue(
      req.params["id"]
    ) as string;

    const {
      article,
      previousSlug,
      currentSlug,
    } = await service.updateArticle(
      id,
      req.body
    );

    auditLog(
      req,
      "UPDATE",
      "ARTICLES",
      `Updated article: ${article.title}`,
      {
        resourceId: id,
        details: {
          title: article.title,
          slug: article.slug,
        },
      }
    );

    emitArticlesUpdated({
      articleId: article.id,
      previousSlug,
      currentSlug,
    });

    emitMediaUpdated();

    res.json(article);
  }
);

/**PATCH /api/articles/:id/publish */
export const publishArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = sanitizeValue(req.params["id"]) as string;

        const article = await service.publishArticle(id);

        notificationService.createForEvent(
            "articlePublished",
            `Article published: ${(article as any).title ?? id}.`,
            "article",
        ).catch(() => {});
        auditLog(
            req,
            "PUBLISH",
            "ARTICLES",
            `Published article: ${(article as any).title ?? id}`,
            {
                resourceId: id,
                details: { title: (article as any).title, slug: (article as any).slug },
            }
        );
        emitArticlesUpdated();
        emitMediaUpdated();

        res.json(article);
    }
);

/**PATCH /api/articles/:id/archive */
export const archiveArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = sanitizeValue(req.params["id"]) as string;

        const article = await service.archiveArticle(id);
        auditLog(
            req,
            "ARCHIVE",
            "ARTICLES",
            `Archived article: ${(article as any).title ?? id}`,
            {
                resourceId: id,
                details: { title: (article as any).title, slug: (article as any).slug },
            }
        );
        emitArticlesUpdated();
        emitMediaUpdated();
        res.json(article);
    }
);

/**PATCH /api/articles/:slug/views */
export const incrementArticleViews = asyncHandler(
    async (req: Request, res: Response) => {

        const slug = sanitizeValue(req.params["slug"]) as string;

        await service.incrementArticleViews(slug);

         res.json({ message: "Article view counted" });
    }
);

/**DELETE /api/articles/:id */
export const deleteArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = sanitizeValue(req.params["id"]) as string;

        await service.deleteArticle(id);
        auditLog(
            req,
            "DELETE",
            "ARTICLES",
            `Deleted article: ${id}`,
            { resourceId: id }
        );
        emitArticlesUpdated();
        emitMediaUpdated();
        res.status(204).send();
    }
)
