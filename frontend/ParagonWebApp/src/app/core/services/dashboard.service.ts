import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {

  private readonly http = inject(HttpClient);

  private readonly api = 'http://localhost:3000/api/dashboard';

  private readonly dashboardFeedState = signal<any | null>(null);

  readonly dashboardFeed = this.dashboardFeedState.asReadonly();

  loadDashboardFeed() {
    return this.http
      .get<any>(`${this.api}/feed`)
      .pipe(
        tap(feed => this.dashboardFeedState.set(feed))
      );
  }

  refreshDashboardFeed() {
    return this.loadDashboardFeed();
  }
}
