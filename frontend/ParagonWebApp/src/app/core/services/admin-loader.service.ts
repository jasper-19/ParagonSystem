import { Injectable, OnDestroy } from '@angular/core';
import { LoadingState } from '../../shared/services/loading-state';
@Injectable({providedIn:'root'})
export class AdminLoaderService implements OnDestroy {
  private readonly state = new LoadingState();
  readonly isLoading$ = this.state.isLoading$;
  begin(): number { return this.state.begin(); }
  end(token?: number): void { this.state.end(token); }
  reset(): void { this.state.reset(); }
  ngOnDestroy(): void { this.reset(); }
}
