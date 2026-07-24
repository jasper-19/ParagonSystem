export type DashboardAnalyticsMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type AnalyticsMetric = {
  label: string;
  value: number;
  change: number;
};

export type AnalyticsTrend = {
  labels: string[];
  articles: number[];
  applications: number[];
};

export type DashboardAnalytics = {
  metrics: AnalyticsMetric[];
  trend: AnalyticsTrend;
};

export type DashboardFeed = {
  articles: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
    recent: unknown[];
  };

  applications: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    recent: unknown[];
  };

  specialIssues: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
    recent: unknown[];
  };

  staff: {
    total: number;
    assigned: number;
    eligible: number;
    recent: unknown[];
  };

  analytics: DashboardAnalytics;
};