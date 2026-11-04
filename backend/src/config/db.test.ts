import assert from "node:assert/strict";
import { after, afterEach, mock, test } from "node:test";
import type { PoolClient } from "pg";

process.env.DB_POOL_WARM_COUNT = "2";
process.env.DB_POOL_MAX = "2";
const { default: pool, initializeDatabase } = require("./db") as typeof import("./db");

afterEach(() => mock.restoreAll());
after(async () => pool.end());

test("startup checks connections sequentially and releases every client", async () => {
  const events: string[] = [];
  let count = 0;
  mock.method(pool, "connect", async () => {
    const index = ++count;
    events.push(`connect ${index}`);
    return {
      query: async (sql: string) => {
        assert.equal(sql, "SELECT 1");
        events.push(`query ${index}`);
      },
      release: () => events.push(`release ${index}`),
    } as unknown as PoolClient;
  });

  await initializeDatabase();
  assert.deepEqual(events, [
    "connect 1", "query 1", "connect 2", "query 2", "release 1", "release 2",
  ]);
});

test("startup releases acquired clients when a later connection times out", async () => {
  let attempts = 0;
  let releases = 0;
  mock.method(pool, "connect", async () => {
    if (++attempts === 2) throw new Error("connection timeout");
    return {
      query: async () => {},
      release: () => { releases += 1; },
    } as unknown as PoolClient;
  });

  await assert.rejects(initializeDatabase(), /connection timeout/);
  assert.equal(releases, 1);
});

test("startup releases its client when the database health query fails", async () => {
  let releases = 0;
  mock.method(pool, "connect", async () => ({
    query: async () => { throw new Error("query failed"); },
    release: () => { releases += 1; },
  }) as unknown as PoolClient);

  await assert.rejects(initializeDatabase(), /query failed/);
  assert.equal(releases, 1);
});
