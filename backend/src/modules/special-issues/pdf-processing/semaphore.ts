export class AsyncSemaphore {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) {
      throw new Error("Operation aborted");
    }

    if (this.active >= this.limit) {
      await new Promise<void>((resolve, reject) => {
        const resume = (): void => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        };
        const onAbort = (): void => {
          const index = this.waiting.indexOf(resume);
          if (index >= 0) this.waiting.splice(index, 1);
          reject(new Error("Operation aborted"));
        };
        signal?.addEventListener("abort", onAbort, { once: true });
        this.waiting.push(resume);
      });
    }

    this.active += 1;
    let released = false;

    return () => {
      if (released) return;
      released = true;
      this.active -= 1;
      this.waiting.shift()?.();
    };
  }
}
