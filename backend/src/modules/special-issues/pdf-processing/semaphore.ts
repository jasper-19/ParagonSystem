export class ProcessingQueueError extends Error {
  readonly statusCode = 503;
  constructor(message: string, readonly code: "PDF_PROCESS_QUEUE_FULL" | "PDF_PROCESS_QUEUE_TIMEOUT") {
    super(message);
    this.name = "ProcessingQueueError";
  }
}

export class AsyncSemaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(
    private readonly limit: number,
    private readonly maxWaiting = 8,
    private readonly waitTimeoutMs = 15_000
  ) {
    if (!Number.isSafeInteger(limit) || limit < 1 ||
        !Number.isSafeInteger(maxWaiting) || maxWaiting < 0 ||
        !Number.isFinite(waitTimeoutMs) || waitTimeoutMs <= 0) {
      throw new Error("Invalid processing queue configuration");
    }
  }

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw new Error("Operation aborted");
    }

    if (this.active >= this.limit) {
      if (this.waiting.length >= this.maxWaiting) {
        throw new ProcessingQueueError("PDF processing is busy. Please try again later.", "PDF_PROCESS_QUEUE_FULL");
      }
      await new Promise<void>((resolve, reject) => {
        const removeWaiter = (): void => {
          clearTimeout(timeout);
          signal?.removeEventListener("abort", onAbort);
          const index = this.waiting.indexOf(resume);
          if (index >= 0) this.waiting.splice(index, 1);
        };
        const resume = (): void => {
          removeWaiter();
          resolve();
        };
        const onAbort = (): void => {
          removeWaiter();
          reject(new Error("Operation aborted"));
        };
        const timeout = setTimeout(() => {
          removeWaiter();
          reject(new ProcessingQueueError("PDF processing queue timed out. Please try again later.", "PDF_PROCESS_QUEUE_TIMEOUT"));
        }, this.waitTimeoutMs);
        signal?.addEventListener("abort", onAbort, { once: true });
        this.waiting.push(resume);
      });
    } else {
      this.active += 1;
    }
    let released = false;

    const release = (): void => {
      if (released) return;
      released = true;
      const resume = this.waiting.shift();
      // Hand the occupied slot directly to a waiter. Decrementing before its
      // microtask resumes lets a new caller steal that slot and exceed limit.
      if (resume) resume();
      else this.active -= 1;
    };
    if (signal?.aborted) {
      release();
      throw new Error("Operation aborted");
    }
    return release;
  }
}
