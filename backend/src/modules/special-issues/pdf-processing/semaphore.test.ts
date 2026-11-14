import assert from "node:assert/strict";
import test from "node:test";
import { AsyncSemaphore, ProcessingQueueError } from "./semaphore";

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

test("full queues reject excess work and timed-out waiters release queue capacity", async () => {
  const semaphore = new AsyncSemaphore(1, 1, 20);
  const release = await semaphore.acquire();
  const waiting = semaphore.acquire();
  await assert.rejects(semaphore.acquire(), error => error instanceof ProcessingQueueError && error.code === "PDF_PROCESS_QUEUE_FULL");
  await assert.rejects(waiting, error => error instanceof ProcessingQueueError && error.code === "PDF_PROCESS_QUEUE_TIMEOUT");
  release();
  (await semaphore.acquire())();
});
