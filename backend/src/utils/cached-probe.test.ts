import assert from "node:assert/strict";
import test from "node:test";
import { cachedProbe } from "./cached-probe";

test("readiness probes coalesce in-flight work and expire completed results", async () => {
  let calls = 0, time = 0;
  const probe = cachedProbe(async () => ++calls, 100, () => time);
  const results = await Promise.all([probe(), probe(), probe()]);
  assert.deepEqual(results, [1, 1, 1]);
  assert.equal(await probe(), 1);
  time = 101;
  assert.equal(await probe(), 2);
});
