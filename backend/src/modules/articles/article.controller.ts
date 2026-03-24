import { Request, Response, } from "express";
import * as service from "./article.service"
import * as notificationService from "../notifications/notification.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";

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
        
        res.json(articles);
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
        res.json(article);
    }
);

/** GET /api/articles/category/:category */
export const getArticlesByCategory = asyncHandler(
    async (req: Request, res: Response) =>  {

        const category =  sanitizeValue(req.params["category"]) as string;

        const articles = await service.getArticlesByCategory(category);

        res.json(articles);
    }
);

/** POST /api/articles  - body validated by Zod middleware*/
export const createArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const article = await service.createArticle(req.body);

        notificationService.create(
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

        res.status(201).json(article);
    }
);

/** PATCH /api/articles/: id*/
export const updateArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = sanitizeValue(req.params["id"]) as string;

        const article = await service.updateArticle(id, req.body);
        auditLog(
            req,
            "UPDATE",
            "ARTICLES",
            `Updated article: ${(article as any)?.title ?? id}`,
            {
                resourceId: id,
                details: { title: (article as any)?.title, slug: (article as any)?.slug },
            }
        );

        res.json(article);
    }
);

/**PATCH /api/articles/:id/publish */
export const publishArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = sanitizeValue(req.params["id"]) as string;

        const article = await service.publishArticle(id);

        notificationService.create(
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

        res.status(204).send();
    }
)
