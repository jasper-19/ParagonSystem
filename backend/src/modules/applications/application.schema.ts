import { z } from "zod";

export const YEAR_LEVEL_VALUES = [
  '1st_year',
  '2nd_year',
  '3rd_year',
  '4th_year',
] as const;

export type YearLevel = (typeof YEAR_LEVEL_VALUES)[number];

/** Schema for POST /api/applications */
export const createApplicationSchema = z.object({
  fullName: z.string().min(1, "Full name is required").max(255),
  email: z.string().email("Invalid email address"),
  studentId: z.string().min(1, "Student ID is required").max(50),
  yearLevel: z.enum(YEAR_LEVEL_VALUES, { error: () => ({ message: "Invalid year level" }) }),
  collegeId: z.string().min(1, "College is required").max(50),
  programId: z.string().min(1, "Program is required").max(50),
  positionId: z.string().min(1, "Position is required").max(50),
  subRole: z.string().max(100).optional(),
  motivation: z.string().min(1, "Motivation is required").max(5000),
  // Allow empty string or valid URL (some applicants may not have a portfolio)
  portfolioUrl: z
    .string()
    .url("Invalid portfolio URL")
    .optional()
    .or(z.literal("")),
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
