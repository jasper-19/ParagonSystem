import { z } from "zod";

export const BOARD_SECTION_ROLES = {
  "Executive Editors": [
    "Senior Editor-In-Chief",
    "Junior Editor-In-Chief",
    "Associate Editor (Print)",
    "Associate Editor (Online)",
    "Associate Editor (Broadcast)",
    "Managing Editor",
  ],
  "Section Editors": [
    "News Editor",
    "Column Editor",
    "DevCom Editor",
    "Feature Editor",
    "Sports Editor",
    "Literary Editor",
  ],
  "Staff Writers": [
    "News Writer",
    "Column Writer",
    "Feature Writer",
    "DevCom Writer",
    "Sports Writer",
    "Literary Writer",
  ],
  "Senior Creative Producers": [
    "Cartoonist",
    "Photojournalist",
    "Video Journalist",
    "Layout Artist",
  ],
  "Junior Creative Producers": [
    "Cartoonist",
    "Contributor",
    "Photojournalist",
    "Video Journalist",
    "Layout Artist",
  ],
  Broadcasters: [
    "Senior Broadcaster",
    "Junior Broadcaster",
  ],
} as const;

export const assignApplicationToBoardSchema = z.object({
  applicationId: z
    .string()
    .uuid("Invalid application ID"),

  section: z
    .string()
    .trim()
    .min(1, "Section is required")
    .max(100, "Section is too long"),

  role: z
    .string()
    .trim()
    .min(1, "Role is required")
    .max(100, "Role is too long"),
});

export type AssignApplicationToBoardInput =
  z.infer<typeof assignApplicationToBoardSchema>;

const assignmentSchema = z.object({
  section: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(100),
});

export const createBoardSchema = z.object({
  academicYear: z
    .string()
    .regex(/^\d{4}-\d{4}$/, "Academic year must use YYYY-YYYY format"),
  adviserName: z.string().trim().min(1).max(255),
});

export const addBoardMemberSchema = assignmentSchema.extend({
  staffId: z.string().uuid("Invalid staff ID"),
});

export const updateBoardMemberSchema = assignmentSchema;

export const satisfyBoardSchema = z.object({
  satisfied: z.boolean(),
});
