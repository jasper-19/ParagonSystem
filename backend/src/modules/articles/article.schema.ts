import { z } from "zod";
import { sanitizeArticleHtml } from "../../security/sanitize-html";

/** Allowed article statuses */
export const ARTICLE_STATUS_VALUES = [
  "Draft",
  "Published",
  "Archived",
] as const;

export type ArticleStatus =
  (typeof ARTICLE_STATUS_VALUES)[number];

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

export type ArticleCategory =
  (typeof ARTICLE_CATEGORY_VALUES)[number];

const MAX_DATA_URL_CHARS = 28_000_000;
const MAX_ARTICLE_CONTENT_CHARS = 1_000_000;

const articleImageSchema = z
  .string()
  .max(MAX_DATA_URL_CHARS)
  .refine(value => {
    if (value === "") {
      return true;
    }

    try {
      if (new URL(value).protocol === "https:") {
        return true;
      }
    } catch {
      // Continue with data URL validation.
    }

    return /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(
      value
    );
  }, "Image must be an HTTPS URL or supported image data URL");

/**
 * Stable staff references used for validating article credits
 * against the active editorial board.
 */
const articleCreditIdsSchema = z
  .array(
    z.string().uuid("Invalid staff member ID")
  )
  .max(20, "Too many credited staff members");

/** Schema for POST /api/articles */
export const createArticleSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(255),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase and hyphenated"
    ),

  excerpt: z
    .string()
    .min(1, "Excerpt is required")
    .max(2000),

  content: z
    .string()
    .min(1, "Content is required")
    .max(MAX_ARTICLE_CONTENT_CHARS)
    .transform(sanitizeArticleHtml),

  image: articleImageSchema.optional(),

  /**
   * Existing display-name fields.
   * Keep these temporarily so current articles and UI do not break.
   */
  author: z
    .string()
    .min(1, "Author is required")
    .max(2000),

  photoby: z
    .string()
    .max(2000)
    .optional(),

  graphicby: z
    .string()
    .max(2000)
    .optional(),

  illusrationby: z
    .string()
    .max(2000)
    .optional(),

  /**
   * New stable staff references.
   * These will be validated against the active editorial board.
   */
  authorIds: articleCreditIdsSchema
    .min(1, "At least one author is required"),

  photoByIds: articleCreditIdsSchema
    .optional()
    .default([]),

  graphicByIds: articleCreditIdsSchema
    .optional()
    .default([]),

  illustrationByIds: articleCreditIdsSchema
    .optional()
    .default([]),

  category: z.enum(ARTICLE_CATEGORY_VALUES, {
    error: () => ({
      message: "Invalid category",
    }),
  }),

  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional(),

  status: z.enum(ARTICLE_STATUS_VALUES),

  featured: z
    .boolean()
    .optional()
    .default(false),
});

/** Schema for PATCH /api/articles/:id */
export const updateArticleSchema = z.object({
  title: z
    .string()
    .min(1)
    .max(255)
    .optional(),

  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase and hyphenated"
    )
    .optional(),

  excerpt: z
    .string()
    .min(1)
    .max(2000)
    .optional(),

  content: z
    .string()
    .min(1)
    .max(MAX_ARTICLE_CONTENT_CHARS)
    .transform(sanitizeArticleHtml)
    .optional(),

  image: articleImageSchema.optional(),

  author: z
    .string()
    .min(1)
    .max(2000)
    .optional(),

  photoby: z
    .string()
    .max(2000)
    .optional(),

  graphicby: z
    .string()
    .max(2000)
    .optional(),

  illusrationby: z
    .string()
    .max(2000)
    .optional(),

  authorIds: articleCreditIdsSchema.optional(),

  photoByIds: articleCreditIdsSchema.optional(),

  graphicByIds: articleCreditIdsSchema.optional(),

  illustrationByIds:
    articleCreditIdsSchema.optional(),

  category:
    z.enum(ARTICLE_CATEGORY_VALUES).optional(),

  tags: z
    .array(z.string().max(50))
    .max(20)
    .optional(),

  status:
    z.enum(ARTICLE_STATUS_VALUES).optional(),

  featured: z.boolean().optional(),
});

/** Schema for PATCH /api/articles/:id/publish */
export const publishArticleSchema = z.object({
  status: z.literal("Published"),
});
