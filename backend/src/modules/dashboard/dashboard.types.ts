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
};