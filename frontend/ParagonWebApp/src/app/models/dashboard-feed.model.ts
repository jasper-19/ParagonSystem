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

export type AnalyticsMode =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly';

export type DashboardFeed = {
  articles: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
    recent: any[];
  };

  applications: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    recent: any[];
  };

  specialIssues: {
    total: number;
    published: number;
    drafts: number;
    archived: number;
    recent: any[];
  };

  staff: {
    total: number;
    assigned: number;
    eligible: number;
    recent: any[];
  };

  analytics: DashboardAnalytics;
};
