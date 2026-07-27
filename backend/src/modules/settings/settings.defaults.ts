import {
  GeneralSettings,
  MaintenanceSettings,
  NotificationSettings,
  PublishingMediaSettings,
} from "./settings.types";

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  siteName: "The Paragon",
  organizationName: "Cagayan State University - Gonzaga",
  contactEmail: "",
  logoUrl: "",
  timezone: "Asia/Manila",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "12h",
};

export const DEFAULT_PUBLISHING_MEDIA_SETTINGS: PublishingMediaSettings = {
  allowDirectPublishing: true,
  requireFeaturedImage: true,
  maxUploadSizeMb: 25,
  allowedMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
  ],
  optimizeImages: true,
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  inAppEnabled: true,
  applicationEvents: true,
  articleCreated: true,
  articlePublished: true,
};

export const DEFAULT_MAINTENANCE_SETTINGS: MaintenanceSettings = {
  enabled: false,
  message:
    "The publication site is temporarily unavailable while scheduled maintenance is completed.",
  allowAdminBypass: true,
};

