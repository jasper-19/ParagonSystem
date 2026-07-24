import * as articleRepository from "../articles/article.repository";
import * as applicationRepository from "../applications/application.repository";
import * as specialIssueRepository from "../special-issues/special-issue.repository";
import * as staffRepository from "../staff/staff.repository";
import { DashboardAnalyticsMode, DashboardFeed } from "./dashboard.types";
import { DashboardAnalytics, } from "./dashboard.types";

export async function getDashboardFeed(
  mode: DashboardAnalyticsMode = "daily"
): Promise<DashboardFeed> {
  const [articles, applications, specialIssues, staff, articleTrendRows, applicationTrendRows] = await Promise.all([
    articleRepository.getDashboardSummary(),
    applicationRepository.getDashboardSummary(),
    specialIssueRepository.getDashboardSummary(),
    staffRepository.getDashboardSummary(),
    articleRepository.getPublishedCountsByDate(),
    applicationRepository.getCreatedCountsByDate(),
  ]);

  const analytics: DashboardAnalytics = {
    metrics: [
      {
        label: `Published Articles (${mode})`,
        value: articles.published,
        change: 0,
      },
      {
        label: `Applications (${mode})`,
        value: applications.total,
        change: 0,
      },
    ],
    trend: buildTrend(mode, articleTrendRows, applicationTrendRows),
  };

  return {
    articles,
    applications,
    specialIssues,
    staff,
    analytics,
  };
}

function toDateKey(date: string | Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

function buildTrend(
  mode: DashboardAnalyticsMode,
  articleRows: { date: string | Date; count: number }[],
  applicationRows: { date: string | Date; count: number }[]
) {
  const labels: string[] = [];
  const articles: number[] = [];
  const applications: number[] = [];

  const articleMap = new Map(
    articleRows.map(row => [toDateKey(row.date), row.count])
  );

  const applicationMap = new Map(
    applicationRows.map(row => [toDateKey(row.date), row.count])
  );

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let bucketCount = 30;
  let bucketType: "day" | "week" | "month" | "year" = "day";

  if (mode === "weekly") {
    bucketCount = 12;
    bucketType = "week";
  }

  if (mode === "monthly") {
    bucketCount = 12;
    bucketType = "month";
  }

  if (mode === "yearly") {
    bucketCount = 5;
    bucketType = "year";
  }

  for (let i = bucketCount - 1; i >= 0; i--) {
    const bucketStart = new Date(now);

    if (bucketType === "day") {
      bucketStart.setDate(now.getDate() - i);
    }

    if (bucketType === "week") {
      bucketStart.setDate(now.getDate() - i * 7);
    }

    if (bucketType === "month") {
      bucketStart.setMonth(now.getMonth() - i);
      bucketStart.setDate(1);
    }

    if (bucketType === "year") {
      bucketStart.setFullYear(now.getFullYear() - i);
      bucketStart.setMonth(0, 1);
    }

    bucketStart.setHours(0, 0, 0, 0);

    const bucketEnd = new Date(bucketStart);

    if (bucketType === "day") bucketEnd.setDate(bucketStart.getDate() + 1);
    if (bucketType === "week") bucketEnd.setDate(bucketStart.getDate() + 7);
    if (bucketType === "month") bucketEnd.setMonth(bucketStart.getMonth() + 1);
    if (bucketType === "year") bucketEnd.setFullYear(bucketStart.getFullYear() + 1);

    const label =
      bucketType === "day"
        ? bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : bucketType === "week"
          ? `Week of ${bucketStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
          : bucketType === "month"
            ? bucketStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" })
            : String(bucketStart.getFullYear());

    labels.push(label);

    const countInBucket = (
      rows: { date: string | Date; count: number }[]
    ) =>
      rows
        .filter(row => {
          const date = new Date(row.date);
          return date >= bucketStart && date < bucketEnd;
        })
        .reduce((sum, row) => sum + row.count, 0);

    articles.push(countInBucket(articleRows));
    applications.push(countInBucket(applicationRows));
  }

  return {
    labels,
    articles,
    applications,
  };
}