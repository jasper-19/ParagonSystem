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
let refreshInFlight: Promise<GlobalSettings> | null = null;
const CACHE_TTL_MS = 15_000;

function cacheSettings(value: GlobalSettings): GlobalSettings {
  // A read started before a write must never restore an older policy.
  if (!cached || value.version >= cached.value.version) {
    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  }
  return cached.value;
}

export async function getSettings(forceRefresh = false): Promise<GlobalSettings> {
  if (!forceRefresh && cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  if (!refreshInFlight) {
    refreshInFlight = repository.get().then(cacheSettings).finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
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

  cacheSettings(updated);
  return updated;
}

export async function getPublicSettings(minimumVersion = 0) {
  let settings = await getSettings();
  // Invalidation events carry the committed version, so another instance's
  // cached policy cannot mask that save. Ordinary visitors share the TTL cache.
  if (settings.version < minimumVersion) settings = await getSettings(true);
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

