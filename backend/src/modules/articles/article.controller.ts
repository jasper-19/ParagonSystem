import { Request, Response, } from "express";
import * as service from "./article.service"
import * as notificationService from "../notifications/notification.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";

/** GET /api/articles?status=<value> */
export const getArticles =  asyncHandler(
    async (req: Request, res: Response) => {

        const raw = req.query["status"];

        const status =
            typeof raw === "string"
            ? (sanitizeValue(raw) as string)
            : undefined

        const articles = await service.getArticles(status);
        
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

        res.status(201).json(article);
    }
);

/** PATCH /api/articles/: id*/
export const updateArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = Number(req.params["id"]);

        const article = await service.updateArticle(id, req.body);

        res.json(article);
    }
);

/**PATCH /api/articles/:id/publish */
export const publishArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = Number(req.params["id"]);

        const article = await service.publishArticle(id);

        notificationService.create(
            `Article published: ${(article as any).title ?? id}.`,
            "article",
        ).catch(() => {});

        res.json(article);
    }
);

/**PATCH /api/articles/:id/archive */
export const archiveArticle = asyncHandler(
    async (req: Request, res: Response) => {

        const id = Number(req.params["id"]);

        const article = await service.archiveArticle(id);

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

        const id =  Number(req.params["id"]);

        await service.deleteArticle(id);

        res.status(204).send();
    }
)