import * as articleRepository from "../articles/article.repository";
import * as applicationRepository from "../applications/application.repository";
import * as specialIssueRepository from "../special-issues/special-issue.repository";
import * as staffRepository from "../staff/staff.repository";

import { DashboardFeed } from "./dashboard.types";

export async function getDashboardFeed(): Promise<DashboardFeed> {
  const [articles, applications, specialIssues, staff] = await Promise.all([
    articleRepository.getDashboardSummary(),
    applicationRepository.getDashboardSummary(),
    specialIssueRepository.getDashboardSummary(),
    staffRepository.getDashboardSummary(),
]);

  return {
    articles,
    applications,
    specialIssues,
    staff,
  };
}