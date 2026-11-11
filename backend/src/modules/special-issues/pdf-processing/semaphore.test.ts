import assert from "node:assert/strict";
import test from "node:test";
import { AsyncSemaphore } from "./semaphore";

test("a new caller cannot take a slot handed to a queued processor", async () => {
  const semaphore = new AsyncSemaphore(1);
  const releaseFirst = await semaphore.acquire();
  const queued = semaphore.acquire();
  releaseFirst();
  let thirdStarted = false;
  const third = semaphore.acquire().then(release => {
    thirdStarted = true;
    return release;
  });
  const releaseQueued = await queued;
  assert.equal(thirdStarted, false);
  releaseQueued();
  const releaseThird = await third;
  assert.equal(thirdStarted, true);
  releaseThird();
  releaseThird();
  (await semaphore.acquire())();
});

test("cancelled waiters are removed without consuming a slot", async () => {
  const semaphore = new AsyncSemaphore(1);
  const release = await semaphore.acquire();
  const controller = new AbortController();
  const waiting = semaphore.acquire(controller.signal);
  controller.abort();
  await assert.rejects(waiting, /aborted/);
  release();
  (await semaphore.acquire())();
});
