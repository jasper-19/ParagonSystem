import { z } from "zod";
import { SUPPORTED_MEDIA_MIME_TYPES } from "./settings.types";

const httpsUrlOrEmpty = z
  .string()
  .trim()
  .max(2048)
  .refine(value => {
    if (!value) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Logo URL must be empty or use HTTPS");

export const generalSettingsSchema = z.object({
  siteName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().min(2).max(160),
  contactEmail: z.union([z.literal(""), z.email().max(254)]),
  logoUrl: httpsUrlOrEmpty,
  timezone: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .refine(value => {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA timezone"),
  dateFormat: z.enum(["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
  timeFormat: z.enum(["12h", "24h"]),
});

export const publishingMediaSettingsSchema = z.object({
  allowDirectPublishing: z.boolean(),
  requireFeaturedImage: z.boolean(),
  maxUploadSizeMb: z.number().int().min(1).max(100),
  allowedMimeTypes: z
    .array(z.enum(SUPPORTED_MEDIA_MIME_TYPES))
    .min(1)
    .max(SUPPORTED_MEDIA_MIME_TYPES.length),
  optimizeImages: z.boolean(),
});

export const notificationSettingsSchema = z.object({
  inAppEnabled: z.boolean(),
  applicationEvents: z.boolean(),
  articleCreated: z.boolean(),
  articlePublished: z.boolean(),
});

export const maintenanceSettingsSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(10).max(500),
  allowAdminBypass: z.boolean(),
});

function updateEnvelope<T extends z.ZodType>(schema: T) {
  return z.object({
    data: schema,
    expectedVersion: z.number().int().positive(),
  });
}

export const generalSettingsUpdateSchema =
  updateEnvelope(generalSettingsSchema);
export const publishingMediaSettingsUpdateSchema =
  updateEnvelope(publishingMediaSettingsSchema);
export const notificationSettingsUpdateSchema =
  updateEnvelope(notificationSettingsSchema);
export const maintenanceSettingsUpdateSchema =
  updateEnvelope(maintenanceSettingsSchema);

