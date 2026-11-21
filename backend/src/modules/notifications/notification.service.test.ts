import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { after, afterEach, beforeEach, mock, test } from "node:test";
import type { Response } from "express";
import pool from "../../config/db";
import * as service from "./notification.service";

class Stream extends EventEmitter {
  writableEnded = false;
  destroyed = false;
  frames: string[] = [];
  accepting = true;
  write(frame: string) { this.frames.push(frame); return this.accepting; }
  end() { this.writableEnded = true; this.emit("close"); return this; }
  destroy() { this.destroyed = true; this.emit("close"); return this; }
  response() { return this as unknown as Response; }
}

const streams: Stream[] = [];
const settle = () => new Promise(resolve => setTimeout(resolve, 80));
const row = { id: "sample", message: "Saved", type: "info", is_read: false, created_at: new Date() };
let failWrite = false;
let queries: { sql: string; values?: unknown[] }[];
beforeEach(() => {
  failWrite = false;
  queries = [];
  mock.method(pool, "query", async (sql: string, values?: unknown[]) => {
    queries.push({ sql, ...(values ? { values } : {}) });
    if (failWrite) throw new Error("Database unavailable");
    return { rows: [row] };
  });
});
afterEach(() => {
  streams.splice(0).forEach(stream => service.removeClient(stream.response()));
  mock.restoreAll();
});
after(() => pool.end());

function stream(authorize: () => Promise<boolean> = async () => true, account = "sample"): Stream {
  const result = new Stream(); streams.push(result);
  assert.equal(service.addClient(result.response(), authorize, account), true);
  return result;
}

test("coalesces bursts into private payload-free invalidations and synchronizes read-all", async () => {
  let checks = 0;
  const client = stream(async () => { checks += 1; return true; });
  await Promise.all(Array.from({ length: 30 }, () => service.create("Private notice", "staff")));
  await settle();
  assert.equal(checks, 1);
  assert.deepEqual(client.frames, ["event: notifications:updated\ndata: {}\n\n"]);
  assert.ok(!client.frames[0]!.includes("Private notice"));
  await service.markAllRead(); await settle();
  assert.equal(client.frames.length, 2);
  assert.ok(queries.some(query => query.sql.startsWith("UPDATE notifications")));
});

test("does not overlap authorization and ignores late authorization after disconnect", async () => {
  let finish!: (value: boolean) => void;
  let checks = 0;
  const client = stream(() => { checks += 1; return new Promise(resolve => { finish = resolve; }); });
  await settle();
  await Promise.all(Array.from({ length: 20 }, () => service.create("Saved")));
  await settle();
  assert.equal(checks, 1);
  client.emit("close"); finish(true); await settle();
  assert.equal(checks, 1);
  assert.deepEqual(client.frames, []);
  assert.equal(client.listenerCount("close"), 0);
  assert.equal(client.listenerCount("error"), 0);
});

test("closes revoked and stalled streams and removes their future work", async () => {
  const revoked = stream(async () => false, "revoked");
  const stalled = stream(async () => true, "stalled"); stalled.accepting = false;
  await settle();
  assert.equal(revoked.writableEnded, true);
  assert.deepEqual(revoked.frames, []);
  assert.equal(stalled.destroyed, true);
  await service.create("Another save"); await settle();
  assert.equal(stalled.frames.length, 1);
  assert.equal(revoked.listenerCount("close"), 0);
});

test("failed saves do not notify and transport failures cannot reject a committed save", async () => {
  const client = stream(); await settle();
  failWrite = true;
  await assert.rejects(service.create("Rejected"), /Database unavailable/);
  await assert.rejects(service.markAllRead(), /Database unavailable/);
  await settle(); assert.equal(client.frames.length, 1);
  failWrite = false;
  client.write = () => { throw new Error("Broken transport"); };
  assert.equal((await service.create("Committed")).id, "sample");
  await settle(); assert.equal(client.destroyed, true);
});

test("bounds account connections, releases admission on close, and bounds stored fields", async () => {
  for (let index = 0; index < 8; index += 1) stream();
  const excess = new Stream();
  assert.equal(service.addClient(excess.response(), async () => true, "sample"), false);
  streams[0]!.emit("close");
  streams.push(excess);
  assert.equal(service.addClient(excess.response(), async () => true, "sample"), true);
  await service.create(`  Hello\n${"x".repeat(600)}`, "<invalid>");
  const insert = queries.find(query => query.sql.includes("INSERT INTO notifications"));
  assert.equal((insert!.values![0] as string).length, 500);
  assert.ok(!(insert!.values![0] as string).includes("\n"));
  assert.equal(insert!.values![1], "info");
  await assert.rejects(service.create("\n\t"), /message required/);
});

test("unread snapshots stay bounded with deterministic ordering", async () => {
  await service.getUnread();
  assert.match(queries[0]!.sql, /ORDER BY created_at DESC, id DESC/);
  assert.match(queries[0]!.sql, /LIMIT 50/);
});
