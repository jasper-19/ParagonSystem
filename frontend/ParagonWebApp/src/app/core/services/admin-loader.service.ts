import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminLoaderService {
  private active = 0;
  private readonly loading = new BehaviorSubject<boolean>(false);

  readonly isLoading$ = this.loading.asObservable();

  begin(): void {
    this.active += 1;
    if (this.active === 1) {
      this.loading.next(true);
    }
  }

  end(): void {
    this.active = Math.max(0, this.active - 1);
    if (this.active === 0) {
      this.loading.next(false);
    }
  }

  reset(): void {
    this.active = 0;
    this.loading.next(false);
  }
}

