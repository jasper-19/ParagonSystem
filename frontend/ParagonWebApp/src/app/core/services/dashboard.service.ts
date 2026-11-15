import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs/operators';
import { AnalyticsMode ,DashboardFeed } from '../../models/dashboard-feed.model';
import { API_ENDPOINTS } from '../config/api.config';

@Injectable({
  providedIn: 'root',
})
export class DashboardService {

  private readonly http = inject(HttpClient);

  private readonly api = API_ENDPOINTS.dashboard;

  private readonly dashboardFeedState = signal<DashboardFeed | null>(null);

  readonly dashboardFeed = this.dashboardFeedState.asReadonly();

  loadDashboardFeed(mode: AnalyticsMode = 'daily') {
    return this.http
      .get<DashboardFeed>(`${this.api}/feed`, {
        params: { mode },
      })
      .pipe(
        tap(feed => this.dashboardFeedState.set(feed))
      );
  }

  refreshDashboardFeed(mode: AnalyticsMode = 'daily') {
    return this.loadDashboardFeed(mode);
  }
}
