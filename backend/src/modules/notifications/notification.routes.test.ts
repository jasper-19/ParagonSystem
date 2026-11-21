import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, afterEach, mock, test } from "node:test";
import express from "express";
import pool from "../../config/db";
import { csrfProtection } from "../../middlewares/csrf";
import { signAuthToken } from "../../security/auth-token";
import { drainAuditLogs } from "../activity-logs/activity-log.audit";
import routes from "./notification.routes";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "notification-route-test-secret-at-least-32-bytes";

afterEach(async () => { await drainAuditLogs(); mock.restoreAll(); });
after(() => pool.end());

async function withServer(run: (base: string) => Promise<void>): Promise<void> {
  const app = express();
  app.use(csrfProtection);
  app.use("/notifications", routes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}/notifications`);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await drainAuditLogs();
  }
}

function credential(role: "admin" | "staff" = "admin"): string {
  return signAuthToken({ subject: "env-admin", role });
}

test("notification routes reject anonymous/non-admin requests and protect cookie read-all mutations", { timeout: 15_000 }, async () => {
  let read = false;
  let updates = 0;
  mock.method(pool, "query", async (sql: string) => {
    if (sql.startsWith("UPDATE notifications")) { updates += 1; read = true; return { rows: [] }; }
    if (sql.includes("FROM notifications")) return { rows: read ? [] : [{
      id: "11111111-1111-4111-8111-111111111111", message: "A staff profile was updated.",
      type: "staff", is_read: false, created_at: "2026-11-21T00:00:00Z",
    }] };
    if (sql.includes("INSERT INTO activity_logs")) return { rows: [{
      id: "22222222-2222-4222-8222-222222222222", action: "READ_ALL",
      resource_type: "NOTIFICATIONS", details: {}, created_at: new Date(),
    }] };
    throw new Error("Unexpected notification-route query");
  });
  await withServer(async base => {
    for (const path of ["", "/stream"]) {
      assert.equal((await fetch(base + path)).status, 401);
      assert.equal((await fetch(base + path, { headers: { Authorization: `Bearer ${credential("staff")}` } })).status, 403);
    }
    const headers = { Cookie: `paragon_session=${credential()}` };
    const snapshot = await fetch(base, { headers });
    assert.equal(snapshot.status, 200);
    assert.match(snapshot.headers.get("cache-control") ?? "", /no-store/);
    const items = await snapshot.json() as Array<{ isRead: boolean }>;
    assert.equal(items.length, 1);
    assert.equal(items[0]!.isRead, false);

    assert.equal((await fetch(`${base}/read-all`, { method: "PATCH" })).status, 401);
    assert.equal((await fetch(`${base}/read-all`, { method: "PATCH", headers: {
      Authorization: `Bearer ${credential("staff")}`,
    } })).status, 403);
    assert.equal((await fetch(`${base}/read-all`, { method: "PATCH", headers: {
      ...headers, Origin: "https://hostile.example", "X-CSRF-Protection": "1",
    } })).status, 403);
    assert.equal((await fetch(`${base}/read-all`, { method: "PATCH", headers: {
      ...headers, Origin: "http://localhost:4200",
    } })).status, 403);
    assert.equal(updates, 0);

    assert.equal((await fetch(`${base}/read-all`, { method: "PATCH", headers: {
      ...headers, Origin: "http://localhost:4200", "X-CSRF-Protection": "1",
    } })).status, 204);
    assert.equal(updates, 1);
    assert.deepEqual(await (await fetch(base, { headers })).json(), []);
  });
});

test("SSE routes send private invalidations, reject excess streams, and release admission after disconnect", { timeout: 15_000 }, async () => {
  const controllers: AbortController[] = [];
  const headers = { Cookie: `paragon_session=${credential()}` };
  await withServer(async base => {
    const open = async () => {
      const controller = new AbortController(); controllers.push(controller);
      const response = await fetch(`${base}/stream`, { headers, signal: controller.signal });
      return { response, controller };
    };
    try {
      const first = await open();
      assert.equal(first.response.status, 200);
      assert.match(first.response.headers.get("content-type") ?? "", /text\/event-stream/);
      assert.match(first.response.headers.get("cache-control") ?? "", /no-store/);
      const firstFrame = await first.response.body!.getReader().read();
      assert.equal(new TextDecoder().decode(firstFrame.value), "event: notifications:updated\ndata: {}\n\n");
      for (let index = 1; index < 8; index += 1) assert.equal((await open()).response.status, 200);
      const excess = (await open()).response;
      assert.equal(excess.status, 503);
      assert.equal(excess.headers.get("retry-after"), "5");
      await excess.json();
      first.controller.abort();

      let replacementStatus = 503;
      for (let attempt = 0; attempt < 20 && replacementStatus === 503; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 25));
        const replacement = (await open()).response;
        replacementStatus = replacement.status;
        if (replacementStatus === 503) await replacement.json();
      }
      assert.equal(replacementStatus, 200);
    } finally {
      controllers.forEach(controller => controller.abort());
    }
  });
});

test("notification snapshots and streams validate real sessions without extending inactivity", { timeout: 15_000 }, async () => {
  const userId = "33333333-3333-4333-8333-333333333333";
  const sessionId = "44444444-4444-4444-8444-444444444444";
  const token = signAuthToken({ subject: userId, sid: sessionId, role: "admin",
    passwordHash: "test-password-hash", authVersion: "0" });
  const headers = { Authorization: `Bearer ${token}` };
  let sessionReads = 0;
  let sessionTouches = 0;
  let active = true;
  mock.method(pool, "query", async (sql: string) => {
    if (sql.includes("FROM users u JOIN user_sessions")) {
      sessionReads += 1;
      return { rows: active ? [{ password_hash: "test-password-hash", auth_version: "0" }] : [] };
    }
    if (sql.startsWith("UPDATE user_sessions")) { sessionTouches += 1; return { rows: [{ id: sessionId }] }; }
    if (sql.includes("FROM notifications") || sql.startsWith("UPDATE notifications")) return { rows: [] };
    if (sql.includes("INSERT INTO activity_logs")) return { rows: [{
      id: "22222222-2222-4222-8222-222222222222", action: "READ_ALL",
      resource_type: "NOTIFICATIONS", details: {}, created_at: new Date(),
    }] };
    throw new Error("Unexpected passive-notification query");
  });
  const controller = new AbortController();
  await withServer(async base => {
    try {
      const snapshot = await fetch(base, { headers });
      assert.equal(snapshot.status, 200);
      await snapshot.json();
      assert.equal(sessionReads, 1);
      assert.equal(sessionTouches, 0);

      const stream = await fetch(`${base}/stream`, { headers, signal: controller.signal });
      assert.equal(stream.status, 200);
      await stream.body!.getReader().read();
      assert.ok(sessionReads >= 3); // The handshake and live frame both revalidate.
      assert.equal(sessionTouches, 0);

      assert.equal((await fetch(`${base}/read-all`, { method: "PATCH", headers })).status, 204);
      assert.equal(sessionTouches, 1); // An explicit action still records activity.
      active = false;
      assert.equal((await fetch(base, { headers })).status, 401);
      assert.equal(sessionTouches, 1);
    } finally {
      controller.abort();
    }
  });
});
