import { z } from "zod";

/** Allowed article statuses */
export const ARTICLE_STATUS_VALUES = [
  "Draft",
  "Published",
  "Archived",
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUS_VALUES)[number];

/** Allowed article categories */
export const ARTICLE_CATEGORY_VALUES = [
  "News",
  "Feature",
  "Editorial",
  "Sports",
  "Column",
  "DevCom",
  "Literary",
] as const;

export type ArticleCategory = (typeof ARTICLE_CATEGORY_VALUES)[number];

/** Schema for POST /api/articles */
export const createArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase and hyphenated"),

  excerpt: z.string().min(1, "Excerpt is required").max(2000),

  content: z.string().min(1, "Content is required"),

  image: z.string().max(500).optional().or(z.literal("")),

  author: z.string().min(1, "Author is required").max(255),

  photoby: z.string().max(255).optional(),
  graphicby: z.string().max(255).optional(),
  illusrationby: z.string().max(255).optional(),

  category: z.enum(ARTICLE_CATEGORY_VALUES, {
    error: () => ({ message: "Invalid category" }),
  }),

  tags: z.array(z.string().max(50)).max(20).optional(),

  status: z.enum(ARTICLE_STATUS_VALUES),

  featured: z.boolean(),
});

/** Schema for PATCH /api/articles/:id */
export const updateArticleSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  excerpt: z.string().min(1).max(2000).optional(),
  content: z.string().min(1).optional(),
  image: z.string().max(500).optional().or(z.literal("")),

  category: z.enum(ARTICLE_CATEGORY_VALUES).optional(),

  tags: z.array(z.string().max(50)).max(20).optional(),

  featured: z.boolean().optional(),
});

/** Schema for PATCH /api/articles/:id/publish */
export const publishArticleSchema = z.object({
  status: z.literal("Published"),
});