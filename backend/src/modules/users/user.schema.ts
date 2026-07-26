import { z } from "zod";

const passwordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine(
    value => Buffer.byteLength(value, "utf8") <= 72,
    "Password must not exceed 72 UTF-8 bytes"
  );

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(100)
    .regex(/^[a-zA-Z0-9._-]+$/, "Username contains unsupported characters"),
  password: passwordSchema,
  role: z.enum(["admin", "staff"]).default("admin"),
  staffId: z.string().uuid().optional(),
});

export const updateUserSchema = z
  .object({
    password: passwordSchema.optional(),
    role: z.enum(["admin", "staff"]).optional(),
    staffId: z.string().uuid().nullable().optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: "At least one field is required",
  });
