import { z } from "zod";

export const createUserSchema = z.object({
  username: z.string().min(3).max(100),
  password: z.string().min(8).max(200),
  role: z.enum(["admin", "staff"]).default("admin"),
  staffId: z.string().uuid().optional(),
});

export const updateUserSchema = z
  .object({
    password: z.string().min(8).max(200).optional(),
    role: z.enum(["admin", "staff"]).optional(),
    staffId: z.string().uuid().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });

