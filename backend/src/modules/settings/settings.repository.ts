import db from "../../config/db";
import {
  DEFAULT_GENERAL_SETTINGS,
  DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PUBLISHING_MEDIA_SETTINGS,
} from "./settings.defaults";
import {
  GlobalSettings,
  SettingsSection,
} from "./settings.types";

function mapRow(row: any): GlobalSettings {
  return {
    general: {
      ...DEFAULT_GENERAL_SETTINGS,
      ...(row.general ?? {}),
    },
    publishingMedia: {
      ...DEFAULT_PUBLISHING_MEDIA_SETTINGS,
      ...(row.publishing_media ?? {}),
    },
    notifications: {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...(row.notifications ?? {}),
    },
    maintenance: {
      ...DEFAULT_MAINTENANCE_SETTINGS,
      ...(row.maintenance ?? {}),
    },
    version: Number(row.version),
    updatedAt: new Date(row.updated_at).toISOString(),
    updatedBy: row.updated_by ? String(row.updated_by) : null,
  };
}

export async function get(): Promise<GlobalSettings> {
  const result = await db.query(
    `SELECT general, publishing_media, notifications, maintenance,
            version, updated_at, updated_by
       FROM system_settings
      WHERE id = 1`
  );

  if (!result.rows[0]) {
    throw Object.assign(new Error("Global settings have not been initialized"), {
      statusCode: 503,
    });
  }

  return mapRow(result.rows[0]);
}

const SECTION_COLUMNS: Record<SettingsSection, string> = {
  general: "general",
  publishingMedia: "publishing_media",
  notifications: "notifications",
  maintenance: "maintenance",
};

export async function updateSection(
  section: SettingsSection,
  data: unknown,
  expectedVersion: number,
  updatedBy: string | null
): Promise<GlobalSettings | null> {
  const column = SECTION_COLUMNS[section];
  const result = await db.query(
    `UPDATE system_settings
        SET ${column} = $1::jsonb,
            version = version + 1,
            updated_at = NOW(),
            updated_by = $2
      WHERE id = 1
        AND version = $3
      RETURNING general, publishing_media, notifications, maintenance,
                version, updated_at, updated_by`,
    [JSON.stringify(data), updatedBy, expectedVersion]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

