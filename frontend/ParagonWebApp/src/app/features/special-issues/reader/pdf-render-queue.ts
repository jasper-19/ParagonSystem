/** Bound canvas work independently of how quickly the user turns pages. */
export class PdfRenderQueue {
  private active = 0;
  private waiting: { start: () => void; reject: (reason: Error) => void }[] = [];
  constructor(private readonly concurrency = 2) {}

  run<T>(work: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.active++;
        void Promise.resolve().then(work).then(resolve, reject).finally(() => {
          this.active--;
          this.waiting.shift()?.start();
        });
      };
      if (this.active < this.concurrency) start();
      else this.waiting.push({ start, reject });
    });
  }

  cancelPending(): void {
    const waiting = this.waiting.splice(0);
    for (const task of waiting) task.reject(new Error('PDF rendering cancelled'));
  }
}
