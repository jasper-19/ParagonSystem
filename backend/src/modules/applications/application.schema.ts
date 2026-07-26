import { z } from "zod";

export const YEAR_LEVEL_VALUES = [
  '1st_year',
  '2nd_year',
  '3rd_year',
  '4th_year',
] as const;

export type YearLevel = (typeof YEAR_LEVEL_VALUES)[number];

const httpsUrlSchema = z
  .string()
  .url("Invalid portfolio URL")
  .refine(value => new URL(value).protocol === "https:", {
    message: "Portfolio URL must use HTTPS",
  });

/** Schema for POST /api/applications */
export const createApplicationSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(255),
  email: z.string().trim().email("Invalid email address").max(320),
  studentId: z.string().trim().min(1, "Student ID is required").max(50),
  yearLevel: z.enum(YEAR_LEVEL_VALUES, { error: () => ({ message: "Invalid year level" }) }),
  collegeId: z.string().min(1, "College is required").max(50),
  programId: z.string().min(1, "Program is required").max(50),
  selectedPositions: z
    .array(
      z.object({
        positionId: z.string().min(1, "Position is required").max(50),
        categories: z
          .array(z.string().trim().min(1).max(100))
          .max(20)
          .default([]),
      })
    )
    .min(1, "At least one position is required")
    .max(10, "Too many selected positions"),
  motivation: z.string().min(1, "Motivation is required").max(5000),
  // Allow empty string or valid URL (some applicants may not have a portfolio)
  portfolioUrl: z.union([httpsUrlSchema, z.literal("")]).optional(),
  additionalNotes: z.string().max(2000).optional(),
});

/** Schema for PATCH /api/applications/:id/status */
export const updateStatusSchema = z.object({
  status: z.enum([
    "pending",
    "interview_scheduled",
    "interview_completed",
    "accepted",
    "rejected",
  ]),
});

/** Schema for PATCH /api/applications/:id/interview */
export const scheduleInterviewSchema = z.object({
  interviewDate: z.string().min(1, "Interview date is required"),
});

/** Schema for PATCH /api/applications/:id/interview-notes */
export const interviewNotesSchema = z.object({
  notes: z.string().min(1, "Notes are required").max(5000),
});

/** Schema for PATCH /api/applications/:id/accept (notes are optional) */
export const acceptApplicationSchema = z.object({
  interviewNotes: z.string().max(5000).optional(),
});

/** Schema for PATCH /api/applications/:id/assign */
export const assignApplicationSchema = z.object({
  section: z.string().min(1, "Section is required").max(100),
  role: z.string().min(1, "Role is required").max(100),
});

/** Schema for PATCH /api/applications/settings */
export const updateApplicationSettingsSchema = z
  .object({
    isOpen: z.boolean().optional(),
    announcement: z
      .string()
      .trim()
      .min(10, "Announcement must be at least 10 characters long")
      .max(500, "Announcement must not exceed 500 characters")
      .optional(),
  })
  .refine(
    data =>
      data.isOpen !== undefined ||
      data.announcement !== undefined,
    {
      message: "At least one settings field is required",
    }
  );
