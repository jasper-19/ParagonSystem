import { BehaviorSubject } from 'rxjs';

/** Token ownership prevents cancelled work from ending a newer loading cycle. */
export class LoadingState {
  private readonly loading = new BehaviorSubject(false);
  readonly isLoading$ = this.loading.asObservable();
  private readonly operations = new Set<number>();
  private nextToken = 0;
  private revealTimer?: ReturnType<typeof setTimeout>;
  private hideTimer?: ReturnType<typeof setTimeout>;
  private visibleSince = 0;

  begin(): number {
    const token = ++this.nextToken;
    this.operations.add(token);
    clearTimeout(this.hideTimer);
    this.hideTimer = undefined;
    if (!this.loading.value && this.revealTimer === undefined) {
      this.revealTimer = setTimeout(() => {
        this.revealTimer = undefined;
        if (!this.operations.size) return;
        this.visibleSince = Date.now();
        this.loading.next(true);
      }, 150);
    }
    return token;
  }

  end(token?: number): void {
    const ownedToken = token ?? this.operations.values().next().value;
    if (ownedToken === undefined || !this.operations.delete(ownedToken) || this.operations.size) return;
    clearTimeout(this.revealTimer);
    this.revealTimer = undefined;
    if (!this.loading.value) return;
    const remaining = Math.max(0, 200 - (Date.now() - this.visibleSince));
    if (remaining === 0) {
      this.loading.next(false);
      return;
    }
    this.hideTimer = setTimeout(() => {
      this.hideTimer = undefined;
      if (!this.operations.size) this.loading.next(false);
    }, remaining);
  }

  reset(): void {
    this.operations.clear();
    clearTimeout(this.revealTimer);
    clearTimeout(this.hideTimer);
    this.revealTimer = this.hideTimer = undefined;
    if (this.loading.value) this.loading.next(false);
  }
}
