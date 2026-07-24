import { Component, inject, DestroyRef, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import {
  RouterLink,
  RouterLinkActive
} from '@angular/router';
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { DashboardFacade } from "./dashboard.facade";
import { ArticlesSummary } from "./components/articles-summary/articles-summary";
import { ApplicationsOverview } from "./components/applications-overview/applications-overview";
import { AnalyticsSection } from "./components/analytics-section/analytics-section";
import { QuickActions, QuickAction } from "./components/quick-actions/quick-actions";
import { ActivityFeed } from "./components/activity-feed/activity-feed";
import { SpecialIssuesSummary } from "./components/special-issues-summary/special-issues-summary";
import { SidebarService } from "../../../core/services/sidebar.service";

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule,
    RouterLink,
    RouterLinkActive,
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

  private readonly sidebarService =
    inject(SidebarService);

  private readonly destroyRef =
    inject(DestroyRef);

  readonly isSidebarOpen = signal(
    this.sidebarService.value
  );

  readonly isMobileView = signal(
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 767px)').matches
  );

  protected readonly facade = inject(DashboardFacade);

  protected readonly quickActions: QuickAction[] = [
    {
      label: 'New Article',
      description: 'Create and publish new content',
      route: '/admin/create-article',
      icon: 'square-pen'
    },
    {
      label: 'Upload Issue',
      description: 'Add a new special issue PDF',
      route: '/admin/create-special-issue',
      icon: 'file-up'
    },
    {
      label: 'Review Applications',
      description: 'Manage pending submissions',
      route: '/admin/applications',
      icon: 'clipboard-check'
    },
    {
      label: 'Media Library',
      description: 'Manage images and assets',
      route: '/admin/media-library',
      icon: 'images'
    }
  ];

  constructor() {
    this.sidebarService.sidebarOpen$
      .pipe(
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(open => {
        this.isSidebarOpen.set(open);
      });

    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return;
    }

    const mediaQuery = window.matchMedia(
      '(max-width: 767px)'
    );

    const handleViewportChange = (
      event: MediaQueryListEvent
    ): void => {
      this.isMobileView.set(
        event.matches
      );
    };

    mediaQuery.addEventListener(
      'change',
      handleViewportChange
    );

    this.destroyRef.onDestroy(() => {
      mediaQuery.removeEventListener(
        'change',
        handleViewportChange
      );
    });
  }

}
