import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import db from "../../config/db";
import * as service from "./settings.service";
import { DEFAULT_GENERAL_SETTINGS, DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PUBLISHING_MEDIA_SETTINGS } from "./settings.defaults";

const row = (version: number) => ({
  general: DEFAULT_GENERAL_SETTINGS,
  publishing_media: DEFAULT_PUBLISHING_MEDIA_SETTINGS,
  notifications: DEFAULT_NOTIFICATION_SETTINGS,
  maintenance: DEFAULT_MAINTENANCE_SETTINGS,
  version, updated_at: "2026-11-15T00:00:00Z", updated_by: null,
});
after(async () => { mock.restoreAll(); await db.end(); });

test("settings reads coalesce, cannot undo committed writes, and recover after failures", async () => {
  let resolveRead!: (value: { rows: ReturnType<typeof row>[] }) => void;
  const query = mock.method(db, "query", async (sql: string) => {
    if (sql.startsWith("UPDATE")) return { rows: [row(2)] };
    return new Promise(resolve => { resolveRead = resolve; });
  });
  const first = service.getSettings(true);
  const second = service.getSettings(true);
  assert.equal(query.mock.callCount(), 1);
  await service.updateSection("general", DEFAULT_GENERAL_SETTINGS, 1, null);
  resolveRead({ rows: [row(1)] });
  assert.equal((await first).version, 2);
  assert.equal((await second).version, 2);
  assert.equal((await service.getSettings()).version, 2);
  assert.equal(query.mock.callCount(), 2);

  query.mock.mockImplementation(async () => { throw new Error("database unavailable"); });
  await assert.rejects(service.getSettings(true), /database unavailable/);
  query.mock.mockImplementation(async () => ({ rows: [row(3)] }));
  assert.equal((await service.getSettings(true)).version, 3);

  query.mock.mockImplementation(async () => ({ rows: [] }));
  await assert.rejects(
    service.updateSection("general", DEFAULT_GENERAL_SETTINGS, 1, null),
    { statusCode: 409 },
  );
  assert.equal((await service.getSettings()).version, 3);

  query.mock.mockImplementation(async () => ({ rows: [row(4)] }));
  const publicSettings = await service.getPublicSettings(4);
  assert.equal(publicSettings.version, 4);
  assert.deepEqual(Object.keys(publicSettings).sort(), ["general", "maintenance", "version"]);
  assert.deepEqual(Object.keys(publicSettings.maintenance).sort(), ["enabled", "message"]);
});
