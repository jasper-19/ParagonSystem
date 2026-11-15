import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import db from "../../config/db";
import { updateArticleStatus } from "./article.service";
import { getSettings } from "../settings/settings.service";
import { DEFAULT_GENERAL_SETTINGS, DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PUBLISHING_MEDIA_SETTINGS } from "../settings/settings.defaults";

after(async () => { mock.restoreAll(); await db.end(); });

test("generic Published transitions enforce direct publishing and cover image policy", async () => {
  let allowDirectPublishing = false;
  const query = mock.method(db, "query", async (sql: string) => {
    if (sql.includes("FROM system_settings")) return { rows: [{
      general: DEFAULT_GENERAL_SETTINGS, maintenance: DEFAULT_MAINTENANCE_SETTINGS,
      notifications: DEFAULT_NOTIFICATION_SETTINGS,
      publishing_media: { ...DEFAULT_PUBLISHING_MEDIA_SETTINGS, allowDirectPublishing },
      version: allowDirectPublishing ? 2 : 1, updated_at: "2026-11-15T00:00:00Z",
    }] };
    if (sql.includes("FROM articles")) return { rows: [{ id: "test", status: "Draft", image: "" }] };
    throw new Error("Publishing must be rejected before any database mutation");
  });
  await assert.rejects(updateArticleStatus("test", "Published"), { statusCode: 403 });
  allowDirectPublishing = true;
  await getSettings(true);
  await assert.rejects(updateArticleStatus("test", "Published"), { statusCode: 422 });
  assert.equal(query.mock.calls.some(call => String(call.arguments[0]).startsWith("UPDATE")), false);
});
