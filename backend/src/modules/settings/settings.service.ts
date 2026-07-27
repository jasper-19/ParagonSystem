import {
  generalSettingsSchema,
  maintenanceSettingsSchema,
  notificationSettingsSchema,
  publishingMediaSettingsSchema,
} from "./settings.schema";
import * as repository from "./settings.repository";
import {
  GlobalSettings,
  SettingsSection,
} from "./settings.types";

let cached: { value: GlobalSettings; expiresAt: number } | null = null;
const CACHE_TTL_MS = 15_000;

export async function getSettings(forceRefresh = false): Promise<GlobalSettings> {
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const value = await repository.get();
  cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function updateSection(
  section: SettingsSection,
  data: unknown,
  expectedVersion: number,
  updatedBy: string | null
): Promise<GlobalSettings> {
  const schemas = {
    general: generalSettingsSchema,
    publishingMedia: publishingMediaSettingsSchema,
    notifications: notificationSettingsSchema,
    maintenance: maintenanceSettingsSchema,
  } as const;
  const parsed = schemas[section].parse(data);
  const updated = await repository.updateSection(
    section,
    parsed,
    expectedVersion,
    updatedBy
  );

  if (!updated) {
    throw Object.assign(
      new Error("Settings changed in another session. Reload and try again."),
      { statusCode: 409 }
    );
  }

  cached = { value: updated, expiresAt: Date.now() + CACHE_TTL_MS };
  return updated;
}

export async function getPublicSettings() {
  const settings = await getSettings();
  return {
    general: settings.general,
    maintenance: {
      enabled: settings.maintenance.enabled,
      message: settings.maintenance.message,
    },
    version: settings.version,
  };
}

export async function shouldCreateNotification(
  event:
    | "application"
    | "articleCreated"
    | "articlePublished"
): Promise<boolean> {
  const { notifications } = await getSettings();
  if (!notifications.inAppEnabled) return false;
  if (event === "application") return notifications.applicationEvents;
  return notifications[event];
}

