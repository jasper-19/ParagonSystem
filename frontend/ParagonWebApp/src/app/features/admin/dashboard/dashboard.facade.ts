import { Injectable, inject, computed, signal } from '@angular/core';
import { DashboardService } from '../../../core/services/dashboard.service';

export interface AnalyticsMetric {
  label: string;
  value: number;
  change: number; // Percentage change compared to a previous period
}

export interface AnalyticsTrend {
  labels: string[]; // e.g., dates or categories
  articles: number[]; // corresponding article counts
  applications: number[]; // corresponding application counts
}

export type AnalyticsMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface ActivityItem {
  id: string;
  type: 'article' | 'application' | 'issue' | 'staff';
  title: string; // e.g., article title or application name
  timestamp: Date;
}

@Injectable({ providedIn: 'root' })
export class DashboardFacade {


  readonly selectedMode = signal<AnalyticsMode>('daily');
  setMode(mode: AnalyticsMode): void {
    this.selectedMode.set(mode);
  }

  private dashboardService = inject(DashboardService);

  readonly dashboardFeed = this.dashboardService.dashboardFeed;

  readonly articleSummary = computed(() =>
    this.dashboardFeed()?.articles
  );

  readonly applicationSummary = computed(() =>
    this.dashboardFeed()?.applications
  );

  readonly specialIssueSummary = computed(() =>
    this.dashboardFeed()?.specialIssues
  );

  readonly staffSummary = computed(() =>
    this.dashboardFeed()?.staff
  );

  constructor() {
    this.dashboardService.loadDashboardFeed().subscribe({
      error: err => console.error('Failed to load dashboard feed', err),
    });
  }

  //Date Utility Helper
private countWithinDays<T>(
  items: T[],
  dateSelector: (item: T) => Date | string | undefined,
  days: number,
  offsetDays = 0
): number {

  const now = new Date();

  const end = new Date(now);
  end.setDate(now.getDate() - offsetDays);

  const start = new Date(end);
  start.setDate(end.getDate() - days);

  return items.filter((item: T) => {

    const rawDate = dateSelector(item);
    if (!rawDate) return false;

    const date = new Date(rawDate);

    return date >= start && date <= end;

  }).length;
}

  // ===== Article Metrics =====

  readonly totalArticles = computed(() =>
    this.articleSummary()?.total ?? 0
  );

  readonly publishedArticles = computed(() =>
    this.articleSummary()?.published ?? 0
  );

  readonly draftArticles = computed(() =>
    this.articleSummary()?.drafts ?? 0
  );

  readonly archivedArticles = computed(() =>
    this.articleSummary()?.archived ?? 0
  );

  readonly recentArticles = computed(() =>
    this.articleSummary()?.recent ?? []
  );

  // ===== Application Metrics =====

  readonly totalApplications = computed(() =>
    this.applicationSummary()?.total ?? 0
  );

  readonly pendingApplications = computed(() =>
    this.applicationSummary()?.pending ?? 0
  );

  readonly acceptedApplications = computed(() =>
    this.applicationSummary()?.accepted ?? 0
  );

  readonly rejectedApplications = computed(() =>
    this.applicationSummary()?.rejected ?? 0
  );

  readonly recentApplications = computed(() =>
    this.applicationSummary()?.recent ?? []
  );

  // ===== Special Issues Metrics =====
  readonly totalSpecialIssues = computed(() =>
    this.specialIssueSummary()?.total ?? 0
  );

  readonly publishedSpecialIssues = computed(() =>
    this.specialIssueSummary()?.published ?? 0
  );

  readonly draftSpecialIssues = computed(() =>
    this.specialIssueSummary()?.drafts ?? 0
  );

  readonly archivedSpecialIssues = computed(() =>
    this.specialIssueSummary()?.archived ?? 0
  );

  readonly recentSpecialIssues = computed(() =>
    this.specialIssueSummary()?.recent ?? []
  );

// ===== Staff Metrics =====
  readonly totalStaff = computed(() =>
    this.staffSummary()?.total ?? 0
  );

  readonly assignedStaff = computed(() =>
    this.staffSummary()?.assigned ?? 0
  );

  readonly eligibleStaff = computed(() =>
    this.staffSummary()?.eligible ?? 0
  );

  readonly recentStaff = computed(() =>
    this.staffSummary()?.recent ?? []
  );

  //Compute Analytics
readonly analyticsMetrics = computed<AnalyticsMetric[]>(() => {
  const mode = this.selectedMode();

  return [
    {
      label: `Articles (${mode})`,
      value: this.publishedArticles(),
      change: 0,
    },
    {
      label: `Applications (${mode})`,
      value: this.totalApplications(),
      change: 0,
    },
  ];
});

  //Analytics Trend Data (for chart)
readonly analyticsTrend = computed<AnalyticsTrend>(() => ({
  labels: [],
  articles: [],
  applications: [],
}));

  readonly activityFeed = computed<ActivityItem[]>(() => {
    const articles = this.recentArticles();
    const applications = this.recentApplications();
    const specialIssues = this.recentSpecialIssues();
    const staff = this.staffSummary()?.recent ?? [];

    const articleActivities: ActivityItem[] = articles
      .filter((a: any) => a.createdAt)
      .map((a: any) => {
        const timestamp = a.publishedAt ?? a.createdAt;

        return {
          id: `article-${a.id}`,
          type: 'article' as const,
          title: `Article ${a.status?.toLowerCase() ?? 'updated'}: ${a.title}`,
          timestamp: new Date(timestamp),
        };
      });

    const applicationActivities: ActivityItem[] = applications
      .filter((a: any) => a.createdAt)
      .map((a: any) => ({
        id: `application-${a.id}`,
        type: 'application' as const,
        title:
          a.status === 'accepted'
            ? `Application accepted: ${a.fullName}`
            : a.status === 'rejected'
              ? `Application rejected: ${a.fullName}`
              : `New application from ${a.fullName}`,
        timestamp: new Date(a.createdAt),
      }));

    const issueActivities: ActivityItem[] = specialIssues
      .filter((i: any) => i.createdAt || i.publishedAt)
      .map((i: any) => ({
        id: `issue-${i.id}`,
        type: 'issue' as const,
        title: `Special issue ${i.status ?? 'updated'}: ${i.title}`,
        timestamp: new Date(i.publishedAt ?? i.createdAt),
      }));

    const staffActivities: ActivityItem[] = staff
      .filter((s: any) => s.createdAt)
      .map((s: any) => ({
        id: `staff-${s.id}`,
        type: 'staff' as const,
        title: `Staff member added: ${s.fullName}`,
        timestamp: new Date(s.createdAt),
      }));

    return [
      ...articleActivities,
      ...applicationActivities,
      ...issueActivities,
      ...staffActivities,
    ]
      .sort((a: ActivityItem, b: ActivityItem) =>
        b.timestamp.getTime() - a.timestamp.getTime()
      )
      .slice(0, 50);
  });
}
