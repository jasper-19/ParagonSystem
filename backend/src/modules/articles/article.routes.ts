import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./article.controller";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import {
  createArticleSchema,
  updateArticleSchema,
  publishArticleSchema,
} from "./article.schema";

const router = Router();

/**
 * Rate limiter for article view counting
 * Prevents bots from inflating views.
 */
const viewLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for article creation
 * Prevents admin abuse or accidental spam.
 */
const createLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * PUBLIC ROUTES
 * These are accessible without authentication.
 */

// GET /api/articles
router.get("/", controller.getArticles);

// GET /api/articles/category/:category
router.get("/category/:category", controller.getArticlesByCategory);

// GET /api/articles/:slug
router.get("/:slug", controller.getArticleBySlug);

// PATCH /api/articles/:slug/views
router.patch("/:slug/views", viewLimiter, controller.incrementArticleViews);


/**
 * ADMIN ROUTES
 * Require authentication.
 */

// POST /api/articles
router.post(
  "/",
  authenticate,
  createLimiter,
  validate(createArticleSchema),
  controller.createArticle
);

// PATCH /api/articles/:id
router.patch(
  "/:id",
  authenticate,
  validate(updateArticleSchema),
  controller.updateArticle
);

// PATCH /api/articles/:id/publish
router.patch(
  "/:id/publish",
  authenticate,
  validate(publishArticleSchema),
  controller.publishArticle
);

// PATCH /api/articles/:id/archive
router.patch(
  "/:id/archive",
  authenticate,
  controller.archiveArticle
);

// DELETE /api/articles/:id
router.delete(
  "/:id",
  authenticate,
  controller.deleteArticle
);

export default router;