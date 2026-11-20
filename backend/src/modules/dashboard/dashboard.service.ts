import * as articleRepository from "../articles/article.repository";
import * as applicationRepository from "../applications/application.repository";
import * as specialIssueRepository from "../special-issues/special-issue.repository";
import * as staffRepository from "../staff/staff.repository";
import { DashboardAnalyticsMode, DashboardFeed } from "./dashboard.types";
import { DashboardAnalytics, } from "./dashboard.types";

export async function getDashboardFeed(
  mode: DashboardAnalyticsMode = "daily"
): Promise<DashboardFeed> {
  const buckets = buildBuckets(mode);
  const start = buckets[0]!.start;
  const end = buckets[buckets.length - 1]!.end;
  const [articles, applications, specialIssues, staff, articleTrendRows, applicationTrendRows] = await Promise.all([
    articleRepository.getDashboardSummary(),
    applicationRepository.getDashboardSummary(),
    specialIssueRepository.getDashboardSummary(),
    staffRepository.getDashboardSummary(),
    articleRepository.getPublishedCountsByDate(start, end),
    applicationRepository.getCreatedCountsByDate(start, end),
  ]);

  const analytics: DashboardAnalytics = {
    metrics: [
      {
        label: "Published Articles (all time)",
        value: articles.published,
        change: 0,
      },
      {
        label: "Applications (all time)",
        value: applications.total,
        change: 0,
      },
    ],
    trend: buildTrend(buckets, articleTrendRows, applicationTrendRows),
  };

  return {
    articles,
    applications,
    specialIssues,
    staff,
    analytics,
  };
}

type TrendRow = { date: string | Date; count: number };
export type TrendBucket = { start: Date; end: Date; label: string };

// SQL grouping and chart boundaries both use UTC, independent of the host timezone.
export function buildBuckets(mode: DashboardAnalyticsMode, now = new Date()): TrendBucket[] {
  const count = mode === "daily" ? 30 : mode === "yearly" ? 5 : 12;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Array.from({ length: count }, (_, index) => {
    const offset = count - 1 - index;
    const start = new Date(today);
    if (mode === "monthly") {
      start.setUTCDate(1);
      start.setUTCMonth(start.getUTCMonth() - offset);
    } else if (mode === "yearly") {
      start.setUTCMonth(0, 1);
      start.setUTCFullYear(start.getUTCFullYear() - offset);
    } else {
      start.setUTCDate(start.getUTCDate() - offset * (mode === "weekly" ? 7 : 1));
    }
    const end = new Date(start);
    if (mode === "monthly") end.setUTCMonth(end.getUTCMonth() + 1);
    else if (mode === "yearly") end.setUTCFullYear(end.getUTCFullYear() + 1);
    else end.setUTCDate(end.getUTCDate() + (mode === "weekly" ? 7 : 1));
    const label = mode === "yearly" ? String(start.getUTCFullYear()) :
      (mode === "weekly" ? "Week of " : "") + start.toLocaleDateString("en-US", {
        timeZone: "UTC", month: "short", ...(mode === "monthly" ? { year: "2-digit" } : { day: "numeric" }),
      });
    return { start, end, label };
  });
}

export function buildTrend(buckets: TrendBucket[], articleRows: TrendRow[], applicationRows: TrendRow[]) {
  // Repositories return ordered date counts; advance once through each series.
  const aggregate = (rows: TrendRow[]) => {
    let cursor = 0;
    return buckets.map(bucket => {
      let total = 0;
      while (cursor < rows.length) {
        const row = rows[cursor]!;
        const date = new Date(row.date);
        if (date >= bucket.end) break;
        if (date >= bucket.start) total += row.count;
        cursor++;
      }
      return total;
    });
  };
  return { labels: buckets.map(bucket => bucket.label), articles: aggregate(articleRows), applications: aggregate(applicationRows) };
}
