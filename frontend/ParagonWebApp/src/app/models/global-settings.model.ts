export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD';
export type TimeFormat = '12h' | '24h';

export interface GeneralGlobalSettings {
  siteName: string;
  organizationName: string;
  contactEmail: string;
  logoUrl: string;
  timezone: string;
  dateFormat: DateFormat;
  timeFormat: TimeFormat;
}

export interface PublishingMediaGlobalSettings {
  allowDirectPublishing: boolean;
  requireFeaturedImage: boolean;
  maxUploadSizeMb: number;
  allowedMimeTypes: string[];
  optimizeImages: boolean;
}

export interface NotificationGlobalSettings {
  inAppEnabled: boolean;
  applicationEvents: boolean;
  articleCreated: boolean;
  articlePublished: boolean;
}

export interface MaintenanceGlobalSettings {
  enabled: boolean;
  message: string;
  allowAdminBypass: boolean;
}

export interface GlobalSettingsSnapshot {
  general: GeneralGlobalSettings;
  publishingMedia: PublishingMediaGlobalSettings;
  notifications: NotificationGlobalSettings;
  maintenance: MaintenanceGlobalSettings;
  version: number;
  updatedAt: string;
  updatedBy: string | null;
}

export type GlobalSettingsSection =
  | 'general'
  | 'publishingMedia'
  | 'notifications'
  | 'maintenance';

export interface PublicGlobalSettings {
  general: GeneralGlobalSettings;
  maintenance: Pick<MaintenanceGlobalSettings, 'enabled' | 'message'>;
  version: number;
}

