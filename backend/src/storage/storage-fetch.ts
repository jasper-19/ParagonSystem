import { AsyncLocalStorage } from "node:async_hooks";

const requestCancellation = new AsyncLocalStorage<AbortSignal>();

export function withStorageCancellation<T>(signal: AbortSignal | undefined, operation: () => Promise<T>): Promise<T> {
  return signal ? requestCancellation.run(signal, operation) : operation();
}

/** Apply a finite transport deadline without sharing request aborts between users. */
export function createStorageFetch(timeoutMs = 60_000, transport: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const signals = [AbortSignal.timeout(timeoutMs)];
    const inherited = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    if (inherited) signals.push(inherited);
    const requestSignal = requestCancellation.getStore();
    if (requestSignal) signals.push(requestSignal);
    return transport(input, { ...init, signal: AbortSignal.any(signals) });
  };
}
