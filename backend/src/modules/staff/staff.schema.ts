import { z } from "zod";

const nullableLimitedString = (maximum: number) =>
  z.string().trim().min(1).max(maximum).nullable().optional();

export const createStaffFromApplicationSchema = z.object({
  section: z.string().trim().min(1).max(100),
  role: z.string().trim().min(1).max(100),
});

export const updateStaffSchema = z
  .object({
    fullName: z.string().trim().min(1).max(255).optional(),
    email: z.string().trim().email().max(320).optional(),
    studentId: nullableLimitedString(50),
    yearLevel: nullableLimitedString(50),
    collegeId: nullableLimitedString(50),
    programId: nullableLimitedString(50),
    positionId: nullableLimitedString(50),
    subRole: nullableLimitedString(100),
    assignedSection: nullableLimitedString(100),
    assignedRole: nullableLimitedString(100),
  })
  .refine(value => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });
