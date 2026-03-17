import { z } from "zod";

export const ISSUE_STATUS_VALUES = ["draft", "published", "archived"] as const;
export type IssueStatus = (typeof ISSUE_STATUS_VALUES)[number];

// Supports base64 data URLs (short-term approach). The overall request body is capped in app.ts.
// Base64 increases payload size by ~33%, so this needs to be comfortably above expected file sizes.
const MAX_DATA_URL_CHARS = 130_000_000;

const ACADEMIC_YEAR_REGEX = /^(\d{4})-(\d{4})$/;

const academicYearSchema = z
  .string()
  .min(1, "Academic year is required")
  .regex(ACADEMIC_YEAR_REGEX, "Academic year must be in YYYY-YYYY format")
  .refine((value) => {
    const match = value.match(ACADEMIC_YEAR_REGEX);
    if (!match) return false;
    const start = Number(match[1]);
    const end = Number(match[2]);
    return Number.isFinite(start) && Number.isFinite(end) && end === start + 1;
  }, "Academic year must span exactly one year (e.g., 2025-2026)");

const dateLikeStringSchema = z
  .string()
  .min(1, "Date is required")
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date");

/** Schema for POST /api/issues */
export const createIssueSchema = z.object({
  title: z.string().min(1, "Title is required").max(255),

  slug: z
    .string()
    .min(1, "Slug is required")
    .max(255)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase and hyphenated"),

  type: z.string().min(1, "Type is required").max(100),

  academicYear: academicYearSchema,

  description: z.string().max(5000).optional().or(z.literal("")),

  coverImage: z
    .string()
    .min(1, "Cover image is required")
    .max(MAX_DATA_URL_CHARS),

  pdfUrl: z.string().min(1, "PDF URL is required").max(MAX_DATA_URL_CHARS),

  publishedAt: dateLikeStringSchema.optional().or(z.literal("")),

  status: z.enum(ISSUE_STATUS_VALUES, {
    error: () => ({ message: "Invalid status" }),
  }),
});

/** Schema for PATCH /api/issues/:id */
export const updateIssueSchema = z
  .object({
    title: z.string().min(1).max(255).optional(),

    slug: z
      .string()
      .min(1)
      .max(255)
      .regex(/^[a-z0-9-]+$/, "Slug must be lowercase and hyphenated")
      .optional(),

    type: z.string().min(1).max(100).optional(),

    academicYear: academicYearSchema.optional(),

    description: z.string().max(5000).optional().or(z.literal("")),

    coverImage: z.string().min(1).max(MAX_DATA_URL_CHARS).optional(),

    pdfUrl: z.string().min(1).max(MAX_DATA_URL_CHARS).optional(),

    publishedAt: dateLikeStringSchema.optional().or(z.literal("")),

    status: z.enum(ISSUE_STATUS_VALUES).optional(),
  })
  .refine(
    (value) => Object.values(value).some((v) => v !== undefined),
    "At least one field is required"
  );

/** Schema for PATCH /api/issues/:id/status */
export const updateIssueStatusSchema = z.object({
  status: z.enum(ISSUE_STATUS_VALUES, {
    error: () => ({ message: "Invalid status" }),
  }),
});
