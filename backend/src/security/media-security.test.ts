import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import pool from "../config/db";
import { DEFAULT_GENERAL_SETTINGS, DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PUBLISHING_MEDIA_SETTINGS } from "../modules/settings/settings.defaults";
import { createMediaFromUpload } from "../modules/media/media.service";

afterEach(() => mock.restoreAll());
after(async () => pool.end());
test("an SVG disguised as a PNG is rejected before storage with optimization disabled", async () => {
  mock.method(pool, "query", async (sql: string) => {
    assert.match(sql, /system_settings/);
    return { rows: [{ general: DEFAULT_GENERAL_SETTINGS,
      maintenance: DEFAULT_MAINTENANCE_SETTINGS, notifications: DEFAULT_NOTIFICATION_SETTINGS,
      publishing_media: { ...DEFAULT_PUBLISHING_MEDIA_SETTINGS,
        allowedMimeTypes: ["image/png"], maxUploadSizeMb: 10, optimizeImages: false },
      version: 1, updated_at: '2026-11-17T00:00:00Z',
    }] };
  });
  const buffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>');
  await assert.rejects(createMediaFromUpload({ originalname: "photo.png", mimetype: "image/png", buffer, size: buffer.length }),
    (error: any) => error.statusCode === 400 && /image type/.test(error.message));
});
