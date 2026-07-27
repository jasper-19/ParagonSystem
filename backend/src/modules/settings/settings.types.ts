export const SUPPORTED_MEDIA_MIME_TYPES = [
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
  "audio/x-wav",
] as const;

export type SupportedMediaMimeType =
  (typeof SUPPORTED_MEDIA_MIME_TYPES)[number];

export interface GeneralSettings {
  siteName: string;
  organizationName: string;
  contactEmail: string;
  logoUrl: string;
  timezone: string;
  dateFormat: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  timeFormat: "12h" | "24h";
}

export interface PublishingMediaSettings {
  allowDirectPublishing: boolean;
  requireFeaturedImage: boolean;
  maxUploadSizeMb: number;
  allowedMimeTypes: SupportedMediaMimeType[];
  optimizeImages: boolean;
}

export interface NotificationSettings {
  inAppEnabled: boolean;
  applicationEvents: boolean;
  articleCreated: boolean;
  articlePublished: boolean;
}

export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
  allowAdminBypass: boolean;
}

export interface GlobalSettings {
  general: GeneralSettings;
  publishingMedia: PublishingMediaSettings;
  notifications: NotificationSettings;
  maintenance: MaintenanceSettings;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export type SettingsSection =
  | "general"
  | "publishingMedia"
  | "notifications"
  | "maintenance";

