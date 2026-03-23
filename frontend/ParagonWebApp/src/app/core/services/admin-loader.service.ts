/*
  AdminLoaderService
  - Purpose: Track active admin-scoped asynchronous operations and expose a
    loading observable that UI components can subscribe to.
  - Note: Only formatting/comments changed; logic preserved exactly.
*/

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AdminLoaderService {
  // Number of active operations that have requested the global admin loader
  private active = 0;

  // Internal subject backing the public observable
  private readonly loading = new BehaviorSubject<boolean>(false);

  // Public observable consumers can subscribe to for UI binding
  readonly isLoading$ = this.loading.asObservable();

  // ===== API =====
  // Signal that an operation has started and the loader should be shown.
  begin(): void {
    this.active += 1;

    // Only emit when transitioning from 0 -> 1 to avoid redundant next() calls
    if (this.active === 1) {
      this.loading.next(true);
    }
  }

  // Signal that an operation has finished and the loader may be hidden.
  end(): void {
    // Ensure we never go below zero
    this.active = Math.max(0, this.active - 1);

    // Only hide when no active operations remain
    if (this.active === 0) {
      this.loading.next(false);
    }
  }

  // Forcefully reset the loader state (used for error recovery or cleanup)
  reset(): void {
    this.active = 0;
    this.loading.next(false);
  }
}

