import { z } from "zod";

const newPasswordSchema = z
  .string()
  .min(12)
  .max(128)
  .refine(
    value => Buffer.byteLength(value, "utf8") <= 72,
    "Password must not exceed 72 UTF-8 bytes"
  );

export const loginSchema = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: newPasswordSchema,
});

export const twoFaPreferenceSchema = z.object({
  enabled: z.boolean(),
});
