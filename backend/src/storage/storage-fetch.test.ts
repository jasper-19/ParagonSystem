import assert from "node:assert/strict";
import test from "node:test";
import { createStorageFetch, withStorageCancellation } from "./storage-fetch";

test("storage transport cancels stalled requests within its deadline", async () => {
  const stalled: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    const rejectAbort = (): void => reject(init?.signal?.reason);
    init?.signal?.addEventListener("abort", rejectAbort, { once: true });
    if (init?.signal?.aborted) rejectAbort();
  });
  // Keep the event loop live; AbortSignal.timeout intentionally uses an unref timer.
  const keepAlive = setTimeout(() => undefined, 1_000);
  try {
    await assert.rejects(createStorageFetch(20, stalled)("https://storage.example.test/file"), { name: "TimeoutError" });
  } finally { clearTimeout(keepAlive); }
});

test("concurrent storage operations keep caller cancellation isolated", async () => {
  const signals: AbortSignal[] = [];
  const transport: typeof fetch = async (_input, init) => {
    signals.push(init!.signal!);
    return new Response("ok");
  };
  const client = createStorageFetch(1_000, transport);
  const first = new AbortController(), second = new AbortController();
  await Promise.all([
    withStorageCancellation(first.signal, () => client("https://storage.example.test/first")),
    withStorageCancellation(second.signal, () => client("https://storage.example.test/second")),
  ]);
  first.abort();
  assert.equal(signals[0]!.aborted, true);
  assert.equal(signals[1]!.aborted, false);
});
