/** Coalesce concurrent readiness calls and briefly cache completed probes. */
export function cachedProbe<T>(probe: () => Promise<T>, ttlMs = 5_000, now = Date.now): () => Promise<T> {
  let cached: { value: T; expires: number } | undefined;
  let pending: Promise<T> | undefined;
  return () => {
    if (cached && now() < cached.expires) return Promise.resolve(cached.value);
    if (pending) return pending;
    pending = Promise.resolve().then(probe).then(value => {
      cached = { value, expires: now() + ttlMs };
      return value;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
