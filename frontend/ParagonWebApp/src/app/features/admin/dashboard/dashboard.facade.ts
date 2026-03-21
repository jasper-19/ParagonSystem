import { Injectable, inject, computed, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ArticleService } from '../../../core/services/article.service';
import { ApplicationService } from '../../../core/services/application.service';
import { SpecialIssueService } from '../../../core/services/special-issue.service';
import { Article } from '../../../models/article.model';
import { Application } from '../../../models/application.model';

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

  private articleService = inject(ArticleService);
  private applicationService = inject(ApplicationService);
  private specialIssueService = inject(SpecialIssueService);
  private applications = toSignal(
    this.applicationService.applications$,
    { initialValue: [] }
  );
  private issues = toSignal(this.specialIssueService.issues$, { initialValue: [] });

  private articles = toSignal(
    this.articleService.getAdminArticles(),
    { initialValue: [] }
  );

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

  totalArticles = computed(() => this.articles().length);

  publishedArticles = computed(() =>
    this.articles().filter(a => a.status === 'Published').length
  );

  draftArticles = computed(() =>
    this.articles().filter(a => a.status === 'Draft').length
  );

  archivedArticles = computed(() =>
    this.articles().filter(a => a.status === 'Archived').length
  );

  // ===== Application Metrics =====

  totalApplications = computed(() => this.applications().length);

  pendingApplications = computed(() =>
    this.applications().filter(a => a.status === 'pending').length
  );

  acceptedApplications = computed(() =>
    this.applications().filter(a => a.status === 'accepted').length
  );

  rejectedApplications = computed(() =>
    this.applications().filter(a => a.status === 'rejected').length
  );

  recentApplications = computed(() =>
    [...this.applications()]
      .sort((a, b) =>
        (b.createdAt?.getTime() ?? 0) -
        (a.createdAt?.getTime() ?? 0)
      )
      .slice(0, 5)
  );

  // ===== Special Issues Metrics =====
  totalIssues = computed(() =>
  this.issues().length
);

publishedIssues = computed(() =>
  this.issues().filter(i => i.status === 'published').length
);

draftIssues = computed(() =>
  this.issues().filter(i => i.status === 'draft').length
);

archivedIssues = computed(() =>
  this.issues().filter(i => i.status === 'archived').length
);

  //Compute Analytics
 readonly analyticsMetrics = computed<AnalyticsMetric[]>(() => {

  const mode = this.selectedMode();
  const articles = this.articles();
  const applications = this.applications();

  let days = 30;

  switch (mode) {
    case 'daily':
      days = 30;
      break;
    case 'weekly':
      days = 7 * 12; // 12 weeks
      break;
    case 'monthly':
      days = 30 * 12; // approx 12 months
      break;
    case 'yearly':
      days = 365 * 5; // 5 years
      break;
  }

  const now = new Date();
  const start = new Date();
  start.setDate(now.getDate() - days);

  const countSince = <T>(
    items: T[],
    selector: (item: T) => Date | string | undefined
  ) => {
    return items.filter(item => {
      const raw = selector(item);
      if (!raw) return false;
      const date = new Date(raw);
      return date >= start;
    }).length;
  };

  const articlesCount = countSince(
    articles,
    (a: Article) => a.publishedAt
  );

  const applicationsCount = countSince(
    applications,
    (a: Application) => a.createdAt
  );

  return [
    {
      label: `Articles (${mode})`,
      value: articlesCount,
      change: 0 // optional: re-add comparison later
    },
    {
      label: `Applications (${mode})`,
      value: applicationsCount,
      change: 0
    }
  ];
});

  //Analytics Trend Data (for chart)
 analyticsTrend = computed<AnalyticsTrend>(() => {

  const mode = this.selectedMode();
  const articles = this.articles();
  const applications = this.applications();

  const now = new Date();

  let start: Date;
  let bucketType: 'day' | 'week' | 'month' | 'year';
  let bucketCount: number;

  switch (mode) {

    case 'daily':
      bucketType = 'day';
      bucketCount = 30;
      start = new Date();
      start.setDate(now.getDate() - (bucketCount - 1));
      start.setHours(0, 0, 0, 0);
      break;

    case 'weekly':
      bucketType = 'week';
      bucketCount = 12;
      start = new Date();
      start.setDate(now.getDate() - (bucketCount - 1) * 7);
      start.setHours(0, 0, 0, 0);
      break;

    case 'monthly':
      bucketType = 'month';
      bucketCount = 12;
      start = new Date();
      start.setMonth(now.getMonth() - (bucketCount - 1));
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      break;

    case 'yearly':
      bucketType = 'year';
      bucketCount = 5;
      start = new Date();
      start.setFullYear(now.getFullYear() - (bucketCount - 1));
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  const labels: string[] = [];
  const articleData: number[] = [];
  const applicationData: number[] = [];

  for (let i = 0; i < bucketCount; i++) {

    const bucketStart = new Date(start);

    if (bucketType === 'day') {
      bucketStart.setDate(start.getDate() + i);
    }

    if (bucketType === 'week') {
      bucketStart.setDate(start.getDate() + i * 7);
    }

    if (bucketType === 'month') {
      bucketStart.setMonth(start.getMonth() + i);
    }

    if (bucketType === 'year') {
      bucketStart.setFullYear(start.getFullYear() + i);
    }

    const bucketEnd = new Date(bucketStart);

    if (bucketType === 'day') bucketEnd.setDate(bucketStart.getDate() + 1);
    if (bucketType === 'week') bucketEnd.setDate(bucketStart.getDate() + 7);
    if (bucketType === 'month') bucketEnd.setMonth(bucketStart.getMonth() + 1);
    if (bucketType === 'year') bucketEnd.setFullYear(bucketStart.getFullYear() + 1);

    // Label formatting
    let label = '';

    if (bucketType === 'day') {
      label = bucketStart.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    }

    if (bucketType === 'week') {
      const weekEnd = new Date(bucketStart);
      weekEnd.setDate(bucketStart.getDate() + 6);

      label = `${bucketStart.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })} - ${weekEnd.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      })}`;
    }

    if (bucketType === 'month') {
      label = bucketStart.toLocaleDateString(undefined, {
        month: 'short',
        year: '2-digit'
      });
    }

    if (bucketType === 'year') {
      label = bucketStart.getFullYear().toString();
    }

    labels.push(label);

    const countInBucket = <T>(
      items: T[],
      dateSelector: (item: T) => Date | string | undefined
    ) => {
      return items.filter(item => {
        const raw = dateSelector(item);
        if (!raw) return false;
        const date = new Date(raw);
        return date >= bucketStart && date < bucketEnd;
      }).length;
    };

    articleData.push(
      countInBucket(articles, (a: Article) => a.publishedAt)
    );

    applicationData.push(
      countInBucket(applications, (a: Application) => a.createdAt)
    );
  }

  return {
    labels,
    articles: articleData,
    applications: applicationData
  };
});

  readonly activityFeed = computed<ActivityItem[]>(() => {

  const articles = this.articles();
  const applications = this.applications();
  const specialIssues = this.issues();

  const articleActivities: ActivityItem[] = articles
    .filter(a => a.createdAt)
    .map(a => {
      let title: string;
      const timestamp = a.publishedAt ?? a.createdAt;

      switch (a.status) {
        case 'Published':
          title = `Article published: ${a.title}`;
          break;
        case 'Draft':
          title = `Draft article created: ${a.title}`;
          break;
        case 'Archived':
          title = `Article archived: ${a.title}`;
          break;
        default:
          title = `Article updated: ${a.title}`;
      }

      return {
        id: `article-${a.id}`,
        type: 'article' as const,
        title,
        timestamp: new Date(timestamp)
      };
    });

  const applicationActivities: ActivityItem[] = applications
    .filter(a => a.createdAt)
    .map(a => {
      let title: string;

      switch (a.status) {
        case 'accepted':
          title = `Application accepted: ${a.fullName}`;
          break;
        case 'rejected':
          title = `Application rejected: ${a.fullName}`;
          break;
        case 'pending':
        default:
          title = `New application from ${a.fullName}`;
      }

      return {
        id: `application-${a.id}`,
        type: 'application' as const,
        title,
        timestamp: new Date(a.createdAt!)
      };
    });

  const issueActivities: ActivityItem[] = specialIssues
    .map(i => {
      let title: string;

      switch (i.status) {
        case 'published':
          title = `Special issue published: ${i.title}`;
          break;
        case 'draft':
          title = `Draft special issue created: ${i.title}`;
          break;
        case 'archived':
          title = `Special issue archived: ${i.title}`;
          break;
        default:
          title = `Special issue updated: ${i.title}`;
      }

      return {
        id: `issue-${i.id}`,
        type: 'issue' as const,
        title,
        timestamp: new Date(i.publishedAt)
      };
    });

  return [
    ...articleActivities,
    ...applicationActivities,
    ...issueActivities
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 50);
});
}
