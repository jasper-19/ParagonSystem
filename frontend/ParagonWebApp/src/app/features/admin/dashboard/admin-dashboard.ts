import { Component, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DashboardFacade } from "./dashboard.facade";
import { ArticlesSummary } from "./components/articles-summary/articles-summary";
import { ApplicationsOverview } from "./components/applications-overview/applications-overview";
import { AnalyticsSection } from "./components/analytics-section/analytics-section";
import { QuickActions, QuickAction } from "./components/quick-actions/quick-actions";
import { ActivityFeed } from "./components/activity-feed/activity-feed";
import { SpecialIssuesSummary } from "./components/special-issues-summary/special-issues-summary";

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule,
    ArticlesSummary,
    SpecialIssuesSummary,
    ApplicationsOverview,
    AnalyticsSection,
    QuickActions,
    ActivityFeed,


  ],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {

  protected readonly facade = inject(DashboardFacade);

  protected readonly quickActions: QuickAction[] = [
  {
    label: 'New Article',
    description: 'Create and publish new content',
    route: '/admin/create-article',
    icon: 'A'
  },
  {
    label: 'Upload Issue',
    description: 'Add new special issue PDF',
    route: '/admin/create-special-issue',
    icon: 'P'
  },
  {
    label: 'Review Applications',
    description: 'Manage pending submissions',
    route: '/admin/applications',
    icon: 'R'
  },
  {
    label: 'Media Library',
    description: 'Manage images and assets',
    route: '/admin/media',
    icon: 'M'
  }
];

}
