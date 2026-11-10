import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, tap } from 'rxjs';
import { vi } from 'vitest';
import { DashboardFacade } from './dashboard.facade';
import { DashboardService } from '../../../core/services/dashboard.service';
import { SocketService } from '../../../core/services/socket.service';
import { DashboardFeed, AnalyticsMode } from '../../../models/dashboard-feed.model';

describe('Dashboard request recovery', () => {
  const feed = {
    articles: { total: 12, published: 8, drafts: 3, archived: 1, recent: [] },
    applications: { total: 0, pending: 0, accepted: 0, rejected: 0, recent: [] },
    specialIssues: { total: 0, published: 0, drafts: 0, archived: 0, recent: [] },
    staff: { total: 0, assigned: 0, eligible: 0, recent: [] },
    analytics: { metrics: [], trend: { labels: [], articles: [], applications: [] } },
  } satisfies DashboardFeed;
  let facade: DashboardFacade;
  let requests: { mode: AnalyticsMode; result: Subject<DashboardFeed> }[];
  let state: ReturnType<typeof signal<DashboardFeed | null>>;

  beforeEach(() => {
    requests = [];
    state = signal<DashboardFeed | null>(null);
    TestBed.configureTestingModule({ providers: [
      DashboardFacade,
      { provide: DashboardService, useValue: {
        dashboardFeed: state.asReadonly(),
        loadDashboardFeed: vi.fn((mode: AnalyticsMode) => {
          const result = new Subject<DashboardFeed>();
          requests.push({ mode, result });
          return result.pipe(tap(value => state.set(value)));
        }),
      } },
      { provide: SocketService, useValue: { onArticlesUpdated: vi.fn(), onApplicationsUpdated: vi.fn() } },
    ] });
    facade = TestBed.inject(DashboardFacade);
    TestBed.tick();
  });
  afterEach(() => TestBed.resetTestingModule());

  it('recovers the same time range after an initial failure', () => {
    requests[0].result.error(new Error('Offline'));
    expect(facade.loadError()).toContain('Unable to load');
    expect(facade.analyticsLoading()).toBe(false);
    facade.retry();
    expect(requests[1].mode).toBe('daily');
    expect(facade.analyticsLoading()).toBe(true);
    expect(facade.loadError()).toBeNull();
    requests[1].result.next(feed);
    requests[1].result.complete();
    expect(facade.totalArticles()).toBe(12);
    expect(facade.analyticsLoading()).toBe(false);
  });

  it('keeps previously loaded data and accepts a new range after an error', () => {
    requests[0].result.next(feed);
    requests[0].result.complete();
    facade.setMode('weekly'); TestBed.tick();
    requests[1].result.error(new Error('Offline'));
    expect(facade.loadError()).toContain('Previously loaded data');
    expect(facade.totalArticles()).toBe(12);
    facade.setMode('monthly'); TestBed.tick();
    expect(requests[2].mode).toBe('monthly');
    requests[2].result.next({ ...feed, articles: { ...feed.articles, total: 20 } });
    requests[2].result.complete();
    expect(facade.totalArticles()).toBe(20);
    expect(facade.loadError()).toBeNull();
  });

  it('cancels an older request without clearing the new request loading state', () => {
    facade.setMode('yearly'); TestBed.tick();
    expect(facade.analyticsLoading()).toBe(true);
    requests[0].result.next(feed);
    expect(facade.dashboardFeed()).toBeNull();
    requests[1].result.next(feed);
    requests[1].result.complete();
    expect(facade.analyticsLoading()).toBe(false);
    expect(facade.totalArticles()).toBe(12);
  });
});
