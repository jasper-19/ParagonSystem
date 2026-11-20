import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import type { AddressInfo } from "node:net";
import express, { Request } from "express";
import db from "../../config/db";
import { auditLog, drainAuditLogs, sanitizeAuditDetails } from "./activity-log.audit";
import { auditRequestFailures } from "./activity-log.middleware";
import routes from "./activity-log.routes";
import authRoutes from "../auth/auth.routes";
import * as mediaController from "../media/media.controller";
import { signAuthToken } from "../../security/auth-token";
import { errorHandler } from "../../middlewares/errorHandler";
import { storageService } from "../../storage/storage.factory";
import { findAll } from "./activity-log.repository";

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "activity-audit-local-test-secret-at-least-32-bytes";
const actor = "11111111-1111-4111-8111-111111111111";
const entity = "22222222-2222-4222-8222-222222222222";
type Captured = { userId: unknown; action: unknown; module: unknown; resourceId: unknown;
  details: Record<string, unknown>; ip: unknown; userAgent: unknown };

function captureWrites(extra?: (sql: string, values: unknown[]) => unknown) {
  const writes: Captured[] = [];
  const statements: string[] = [];
  mock.method(db, "query", async (sql: string, values: unknown[] = []) => {
    statements.push(sql);
    if (sql.includes("INSERT INTO activity_logs")) {
      const [userId, action, module, resourceId, details, ip, userAgent] = values;
      writes.push({ userId, action, module, resourceId, details: details as Record<string, unknown>, ip, userAgent });
      return { rows: [{ id: entity, user_id: userId, action, resource_type: module,
        resource_id: resourceId, details, ip_address: ip, user_agent: userAgent, created_at: new Date() }] };
    }
    if (sql.includes("COUNT(*)")) return { rows: [{ total: 0 }] };
    const custom = extra?.(sql, values);
    if (custom) return custom;
    return { rows: [] };
  });
  return { writes, statements };
}

function request(overrides: Record<string, unknown> = {}): Request {
  return { user: { sub: actor, role: "admin" }, ip: "192.0.2.7",
    headers: { "x-forwarded-for": "malformed attacker data" },
    get: () => "Synthetic browser", ...overrides } as unknown as Request;
}

async function withServer(app: express.Express, run: (base: string) => Promise<void>) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  try { await run(`http://127.0.0.1:${(server.address() as AddressInfo).port}`); }
  finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await drainAuditLogs();
  }
}

afterEach(async () => { await drainAuditLogs(); mock.restoreAll(); });
after(async () => { await db.end(); });

test("audit uses trusted actor/IP, protects reserved metadata and supports text resources", async () => {
  const { writes } = captureWrites();
  await auditLog(request(), "UPDATE", "SYSTEM_SETTINGS", "Changed settings", {
    resourceId: "publishingMedia", userId: entity,
    details: { actorType: "anonymous", actorSubject: "forged", description: "forged", requestId: "forged",
      nested: { Password: "private", access_token: "private", EMAIL: "private", notes: "private" },
      passwordChanged: true, notesChanged: false },
  });
  const event = writes[0]!;
  assert.equal(event.userId, actor);
  assert.equal(event.ip, "192.0.2.7");
  assert.equal(event.resourceId, null);
  assert.equal(event.details.resourceKey, "publishingMedia");
  assert.equal(event.details.description, "Changed settings");
  assert.equal(event.details.actorSubject, actor);
  assert.equal(event.details.actorType, "user");
  assert.equal(event.details.actorRole, "admin");
  assert.notEqual(event.details.requestId, "forged");
  assert.equal(event.details.passwordChanged, true);
  assert.equal(event.details.notesChanged, false);
  assert.ok(!JSON.stringify(event).includes("private"));
  await auditLog(request({ ip: "invalid" }), "DELETE", "MEDIA", "Deleted", { resourceId: entity });
  assert.equal(writes[1]!.ip, null);
  assert.equal(writes[1]!.resourceId, entity);
});

test("metadata bounds cyclic, deep and excessive inputs", () => {
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  assert.doesNotThrow(() => JSON.stringify(sanitizeAuditDetails(cycle)));
  const oversized = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`key${i}`, Array(100).fill("x".repeat(10_000))]));
  assert.ok(JSON.stringify(sanitizeAuditDetails(oversized)).length < 70_000);
});

test("repository preserves text resource identity and parameterizes search and Manila date filters", async () => {
  const statements: Array<{ sql: string; values: unknown[] }> = [];
  mock.method(db, "query", async (sql: string, values: unknown[] = []) => {
    statements.push({ sql, values });
    if (sql.includes("COUNT(*)")) return { rows: [{ total: 1 }] };
    return { rows: [{ id: entity, action: "UPDATE", resource_type: "SYSTEM_SETTINGS", created_at: new Date(),
      details: { description: "Updated settings", resourceKey: "general" } }] };
  });
  const result = await findAll({ search: "' OR TRUE --", dateFrom: "2026-11-15", page: 1, limit: 25 });
  assert.equal(result.items[0]!.entityId, "general");
  assert.equal(result.items[0]!.description, "Updated settings");
  assert.match(statements[1]!.sql, /AT TIME ZONE 'Asia\/Manila'/);
  assert.match(statements[1]!.sql, /al\.resource_id::text ILIKE/);
  assert.match(statements[1]!.sql, /al\.created_at DESC,\s+al\.id DESC/);
  assert.doesNotMatch(statements[1]!.sql, /OR TRUE/);
  assert.deepEqual(statements[1]!.values, ["2026-11-15", "%' OR TRUE --%", 25, 0]);
});

test("audit is awaited and shutdown waits for pending writes", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  mock.method(db, "query", async () => {
    await gate;
    return { rows: [{ id: entity, action: "UPDATE", resource_type: "MEDIA", created_at: new Date() }] };
  });
  let completed = false;
  const write = auditLog(request(), "UPDATE", "MEDIA", "Updated").then(() => { completed = true; });
  let drained = false;
  const drain = drainAuditLogs().then(() => { drained = true; });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(completed, false); assert.equal(drained, false);
  release(); await Promise.all([write, drain]);
  assert.equal(completed, true); assert.equal(drained, true);
});

test("production audit failures are observable without raw database error or PII", async () => {
  const previous = process.env.NODE_ENV;
  const messages: unknown[][] = [];
  mock.method(console, "error", (...args: unknown[]) => messages.push(args));
  mock.method(db, "query", async () => { throw Object.assign(new Error("secret SQL and applicant data"), { code: "22P02" }); });
  process.env.NODE_ENV = "production";
  try {
    await assert.doesNotReject(auditLog(request(), "UPDATE", "MEDIA", "Updated"));
    assert.match(JSON.stringify(messages), /AUDIT_WRITE_FAILED/);
    assert.match(JSON.stringify(messages), /22P02/);
    assert.doesNotMatch(JSON.stringify(messages), /secret SQL|applicant data/);
  } finally { process.env.NODE_ENV = previous; }
});

test("failure middleware records security/failed mutations once and excludes URLs, bodies and successful reads", async () => {
  const { writes } = captureWrites();
  const app = express();
  app.use("/api", auditRequestFailures);
  app.use(express.json());
  app.post("/api/auth/login", (_req, res) => { res.sendStatus(401); });
  app.patch("/api/media/:id", (_req, res) => { res.sendStatus(415); });
  app.get("/api/users", (_req, res) => { res.sendStatus(403); });
  app.post("/api/applications", (_req, res) => { res.sendStatus(429); });
  app.get("/api/articles", (_req, res) => { res.json([]); });
  app.get("/api/constructor", (_req, res) => { res.sendStatus(401); });
  await withServer(app, async base => {
    await fetch(`${base}/api/auth/login?password=private`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "bad" }, body: JSON.stringify({ password: "private", username: "private" }) });
    await fetch(`${base}/api/media/private`, { method: "PATCH" });
    await fetch(`${base}/api/users`);
    await fetch(`${base}/api/applications`, { method: "POST" });
    await fetch(`${base}/api/articles`);
    await fetch(`${base}/api/constructor`);
  });
  assert.deepEqual(writes.map(item => item.action), ["AUTHENTICATION_FAILED", "REQUEST_FAILED", "ACCESS_DENIED", "RATE_LIMITED", "AUTHENTICATION_FAILED"]);
  assert.equal(writes[4]!.module, "SYSTEM");
  assert.equal(writes[0]!.details.actorType, "anonymous");
  assert.equal(writes[0]!.details.outcome, "failure");
  assert.equal(writes[1]!.details.route, "/api/media/:id");
  // Random UUIDs can contain "bad"; inspect request-derived values without IDs.
  const sanitizedWrites = writes.map(item => ({ ...item,
    details: { ...item.details, requestId: undefined } }));
  assert.doesNotMatch(JSON.stringify(sanitizedWrites), /private|bad/);
});

test("activity API is admin-only, rejects forged creation and validates filters before querying", async () => {
  const { writes, statements } = captureWrites();
  const app = express(); app.use(express.json()); app.use("/activity-logs", routes);
  const token = (role: "admin" | "staff") => ({ Authorization: `Bearer ${signAuthToken({ subject: "env-admin", role })}` });
  await withServer(app, async base => {
    for (const path of ["/activity-logs", "/activity-logs/filter-options"]) {
      assert.equal((await fetch(base + path)).status, 401);
      assert.equal((await fetch(base + path, { headers: token("staff") })).status, 403);
      assert.equal((await fetch(base + path, { headers: token("admin") })).status, 200);
    }
    for (const query of ["dateFrom=2026-02-31", "dateFrom=not-a-date", "page=-1", "limit=101", "search=" + "x".repeat(201)]) {
      const before = statements.length;
      assert.equal((await fetch(`${base}/activity-logs?${query}`, { headers: token("admin") })).status, 400);
      assert.equal(statements.length, before);
    }
    for (const headers of [{}, token("staff"), token("admin")]) {
      assert.equal((await fetch(`${base}/activity-logs`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ userId: actor, action: "PUBLISH", ipAddress: "192.0.2.1" }) })).status, 404);
    }
  });
  assert.equal(writes.length, 0);
});

test("environment admin logout is audited as a human administrator", async () => {
  const { writes } = captureWrites();
  const app = express(); app.use("/auth", authRoutes);
  await withServer(app, async base => {
    const response = await fetch(`${base}/auth/logout`, { method: "POST", headers: {
      Authorization: `Bearer ${signAuthToken({ subject: "env-admin", role: "admin" })}`,
    } });
    assert.equal(response.status, 204);
  });
  assert.equal(writes.length, 1);
  assert.equal(writes[0]!.action, "LOGOUT");
  assert.equal(writes[0]!.details.actorType, "environment_admin");
});

test("media controllers audit completed changes and never audit failed uploads as success", async () => {
  const { writes } = captureWrites((sql, values) => {
    if (sql.startsWith('SELECT storage_path')) return { rows: (values[0] as string[]).map(storage_path => ({ storage_path })) };
    if (sql.includes("FROM system_settings")) return { rows: [{ version: 1, updated_at: new Date() }] };
    if (sql.includes("INSERT INTO media_files") || sql.includes("UPDATE media_files")) {
      return { rows: [{ id: entity, file_name: "private.pdf", mime_type: "application/pdf", size: 14, created_at: new Date() }] };
    }
    if (sql.includes("DELETE FROM media_files")) return { rows: [{ id: entity, storage_path: "private.pdf" }] };
    return undefined;
  });
  mock.method(db, 'connect', async () => ({ query: db.query.bind(db), release: () => {} }));
  mock.method(storageService, "upload", async () => undefined);
  let cleanupFails = false;
  mock.method(storageService, "remove", async () => { if (cleanupFails) throw new Error("Storage unavailable"); });
  let attachFile = true;
  const app = express(); app.use(express.json());
  app.post("/media", (req, _res, next) => {
    if (attachFile) (req as any).file = { originalname: "private.pdf", mimetype: "application/pdf", size: 14, buffer: Buffer.from("%PDF-1.7\n%%EOF") };
    next();
  }, mediaController.uploadMedia);
  app.patch("/media/:id", mediaController.updateMedia);
  app.delete("/media/:id", mediaController.deleteMedia);
  app.use(errorHandler);
  await withServer(app, async base => {
    assert.equal((await fetch(`${base}/media`, { method: "POST" })).status, 201);
    assert.equal((await fetch(`${base}/media/${entity}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"caption":"private"}' })).status, 200);
    assert.equal((await fetch(`${base}/media/${entity}`, { method: "DELETE" })).status, 204);
    attachFile = false;
    assert.equal((await fetch(`${base}/media`, { method: "POST" })).status, 400);
    cleanupFails = true;
    assert.equal((await fetch(`${base}/media/${entity}`, { method: "DELETE" })).status, 204);
  });
  assert.deepEqual(writes.map(item => item.action), ["UPLOAD", "UPDATE", "DELETE", "DELETE"]);
  assert.doesNotMatch(JSON.stringify(writes), /private/);
});

test("committed media update still returns success when audit storage is unavailable", async () => {
  let updated = false;
  const errors: unknown[][] = [];
  mock.method(console, "error", (...args: unknown[]) => errors.push(args));
  mock.method(db, "query", async (sql: string) => {
    if (sql.includes("UPDATE media_files")) {
      updated = true;
      return { rows: [{ id: entity, size: 0, created_at: new Date() }] };
    }
    if (sql.includes("INSERT INTO activity_logs")) throw Object.assign(new Error("private database error"), { code: "08006" });
    throw new Error("Unexpected query");
  });
  const app = express(); app.use(express.json()); app.patch("/media/:id", mediaController.updateMedia); app.use(errorHandler);
  await withServer(app, async base => {
    assert.equal((await fetch(`${base}/media/${entity}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: '{"caption":"synthetic"}' })).status, 200);
  });
  assert.equal(updated, true);
  assert.match(JSON.stringify(errors), /AUDIT_WRITE_FAILED/);
  assert.doesNotMatch(JSON.stringify(errors), /private database error/);
});
