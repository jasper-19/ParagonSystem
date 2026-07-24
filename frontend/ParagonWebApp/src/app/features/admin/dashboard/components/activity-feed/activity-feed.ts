import { CommonModule } from '@angular/common';
import { Component, computed, effect, input, signal } from '@angular/core';
import { ActivityItem } from '../../dashboard.facade';

type ActivityFilter = 'all' | 'article' | 'application' | 'issue' | 'staff';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-feed.html',
})
export class ActivityFeed {

  readonly activities =
    input.required<ActivityItem[]>();

  readonly pageSizeOptions =
    input<number[]>([5, 10, 20]);

  readonly pageSize = signal(5);
  readonly pageIndex = signal(0);
  readonly selectedFilter =
    signal<ActivityFilter>('all');

  readonly filteredActivities = computed(() => {
    const filter = this.selectedFilter();
    const activities = this.activities();

    if (filter === 'all') {
      return activities;
    }

    return activities.filter(
      activity => activity.type === filter
    );
  });

  readonly totalItems = computed(
    () => this.filteredActivities().length
  );

  readonly totalPages = computed(() => {
    const total = this.totalItems();

    if (total === 0) {
      return 1;
    }

    return Math.max(
      1,
      Math.ceil(total / this.pageSize())
    );
  });

  readonly pageStart = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }

    return (
      this.pageIndex() *
      this.pageSize()
    );
  });

  readonly pageEndExclusive = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }

    return Math.min(
      this.totalItems(),
      this.pageStart() + this.pageSize()
    );
  });

  readonly pagedActivities = computed(() =>
    this.filteredActivities().slice(
      this.pageStart(),
      this.pageEndExclusive()
    )
  );

  readonly canPrev = computed(
    () => this.pageIndex() > 0
  );

  readonly canNext = computed(
    () =>
      this.pageIndex() <
      this.totalPages() - 1
  );

  readonly activityCounts = computed(() => {
    const counts = {
      all: 0,
      article: 0,
      application: 0,
      issue: 0,
      staff: 0,
    };

    for (const activity of this.activities()) {
      counts.all++;
      counts[activity.type]++;
    }

    return counts;
  });

setFilter(filter: ActivityFilter): void {
  if (this.selectedFilter() === filter) {
    return;
  }

  this.selectedFilter.set(filter);
  this.pageIndex.set(0);
}

prevPage(): void {
  if (!this.canPrev()) {
    return;
  }

  this.pageIndex.update(
    index => index - 1
  );
}

nextPage(): void {
  if (!this.canNext()) {
    return;
  }

  this.pageIndex.update(
    index => index + 1
  );
}

setPageSize(rawValue: string): void {
  const nextSize = Number(rawValue);

  if (
    !Number.isFinite(nextSize) ||
    nextSize <= 0 ||
    nextSize === this.pageSize()
  ) {
    return;
  }

  this.pageSize.set(nextSize);
  this.pageIndex.set(0);
}

  constructor() {
    effect(() => {
      this.activities();
      this.pageSize();

      const maxPageIndex = Math.max(
        0,
        this.totalPages() - 1
      );

      if (
        this.pageIndex() >
        maxPageIndex
      ) {
        this.pageIndex.set(
          maxPageIndex
        );
      }
    });
  }

}
