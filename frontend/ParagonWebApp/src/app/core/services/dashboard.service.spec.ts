import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardService } from './dashboard.service';
import { DashboardFeed, AnalyticsMode } from '../../models/dashboard-feed.model';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { API_ENDPOINTS } from '../config/api.config';

describe('DashboardService configured API requests', () => {
  let service: DashboardService;
  let http: HttpTestingController;
  const originalBase = API_ENDPOINTS.base;
  const originalDashboard = API_ENDPOINTS.dashboard;
  const feed: DashboardFeed = {
    articles: { total: 12, published: 8, drafts: 3, archived: 1, recent: [] },
    applications: { total: 0, pending: 0, accepted: 0, rejected: 0, recent: [] },
    specialIssues: { total: 0, published: 0, drafts: 0, archived: 0, recent: [] },
    staff: { total: 0, assigned: 0, eligible: 0, recent: [] },
    analytics: { metrics: [], trend: { labels: [], articles: [], applications: [] } },
  };

  beforeEach(() => {
    // Use a remote API so a hardcoded localhost URL cannot pass this regression test.
    API_ENDPOINTS.base = 'https://api.paragon.test/api';
    API_ENDPOINTS.dashboard = `${API_ENDPOINTS.base}/dashboard`;
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
    ] });
    service = TestBed.inject(DashboardService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    API_ENDPOINTS.base = originalBase;
    API_ENDPOINTS.dashboard = originalDashboard;
    http.verify();
  });

  it('loads the daily feed from the configured remote API with session credentials', () => {
    service.loadDashboardFeed().subscribe();
    const request = http.expectOne('https://api.paragon.test/api/dashboard/feed?mode=daily');
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(service.dashboardFeed()).toBeNull();
    request.flush(feed);
    expect(service.dashboardFeed()).toEqual(feed);
  });

  it('keeps the selected mode when refreshing the feed', () => {
    for (const mode of ['weekly', 'monthly', 'yearly'] as AnalyticsMode[]) {
      service.refreshDashboardFeed(mode).subscribe();
      const request = http.expectOne(`https://api.paragon.test/api/dashboard/feed?mode=${mode}`);
      expect(request.request.withCredentials).toBe(true);
      request.flush(feed);
    }
  });
});
