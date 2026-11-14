import { Injectable, OnDestroy } from '@angular/core';
import { LoadingState } from './loading-state';
@Injectable({providedIn:'root'})
export class LoaderService implements OnDestroy {
  private readonly state = new LoadingState();
  readonly isLoading$ = this.state.isLoading$;
  show(): number { return this.state.begin(); }
  hide(token?: number): void { this.state.end(token); }
  reset(): void { this.state.reset(); }
  ngOnDestroy(): void { this.reset(); }
}
