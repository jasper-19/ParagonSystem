import assert from "node:assert/strict";
import { after, mock, test } from "node:test";
import express from "express";
import type { AddressInfo } from "node:net";
import db from "../../config/db";
import routes from "./settings.routes";
import { errorHandler } from "../../middlewares/errorHandler";
import { enforceMaintenanceMode } from "../../middlewares/maintenance";
import { signAuthToken } from "../../security/auth-token";
import { DEFAULT_GENERAL_SETTINGS, DEFAULT_MAINTENANCE_SETTINGS,
  DEFAULT_NOTIFICATION_SETTINGS, DEFAULT_PUBLISHING_MEDIA_SETTINGS } from "./settings.defaults";

after(async () => { mock.restoreAll(); await db.end(); });

test("settings HTTP authorization, conflict handling and maintenance enforcement", async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "settings-route-test-only-secret-value";
  let current = {
    general: DEFAULT_GENERAL_SETTINGS, publishing_media: DEFAULT_PUBLISHING_MEDIA_SETTINGS,
    notifications: DEFAULT_NOTIFICATION_SETTINGS,
    maintenance: { ...DEFAULT_MAINTENANCE_SETTINGS, enabled: true },
    version: 1, updated_at: "2026-11-15T00:00:00Z", updated_by: null,
  };
  mock.method(db, "query", async (sql: string, values?: unknown[]) => {
    if (sql.includes("UPDATE system_settings")) {
      assert.match(sql, /AND version = \$3/);
      if (values?.[2] !== current.version) return { rows: [] };
      current = { ...current, general: JSON.parse(String(values[0])), version: current.version + 1 };
      return { rows: [current] };
    }
    if (sql.includes("FROM system_settings")) return { rows: [current] };
    if (sql.includes("INSERT INTO activity_logs")) return { rows: [{
      id: "test-audit", action: "UPDATE", resource_type: "SYSTEM_SETTINGS",
      details: {}, created_at: current.updated_at,
    }] };
    return { rows: [] }; // audit writes are also isolated from the database
  });
  const app = express();
  app.use(express.json());
  app.use(enforceMaintenanceMode);
  app.use("/settings", routes);
  app.get("/content", (_req, res) => { res.json({ ok: true }); });
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = (role: "admin" | "staff") => signAuthToken({ subject: "env-admin", role });
  const admin = { Authorization: `Bearer ${token("admin")}`, "Content-Type": "application/json" };
  const staff = { Authorization: `Bearer ${token("staff")}`, "Content-Type": "application/json" };
  try {
    assert.equal((await fetch(`${base}/settings`)).status, 401);
    assert.equal((await fetch(`${base}/settings`, { headers: staff })).status, 403);
    assert.equal((await fetch(`${base}/settings/general`, { method: "PATCH", headers: staff, body: '{}' })).status, 403);
    assert.equal((await fetch(`${base}/settings/general`, { method: "PATCH", headers: admin, body: '{}' })).status, 400);
    const publicResponse = await fetch(`${base}/settings/public`);
    assert.equal(publicResponse.headers.get("cache-control"), "no-store");
    const publicBody = await publicResponse.json() as Record<string, unknown>;
    assert.deepEqual(Object.keys(publicBody).sort(), ["general", "maintenance", "version"]);
    const blocked = await fetch(`${base}/content`);
    assert.equal(blocked.status, 503);
    assert.equal(blocked.headers.get("retry-after"), "900");
    assert.equal((await fetch(`${base}/content`, { headers: admin })).status, 200);
    assert.equal((await fetch(`${base}/content`, { headers: staff })).status, 503);
    const saves = await Promise.all([1, 2].map(() => fetch(`${base}/settings/general`, {
      method: "PATCH", headers: admin,
      body: JSON.stringify({ data: DEFAULT_GENERAL_SETTINGS, expectedVersion: 1 }),
    })));
    assert.deepEqual(saves.map(response => response.status).sort(), [200, 409]);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
