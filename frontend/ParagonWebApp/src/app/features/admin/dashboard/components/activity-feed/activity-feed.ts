import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ActivityItem } from '../../dashboard.facade';

type ActivityFilter = 'all' | 'article' | 'application' | 'issue' | 'staff';

@Component({
  selector: 'app-activity-feed',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-feed.html',
})
export class ActivityFeed {

  @Input({ required: true }) activities: ActivityItem[] = [];

  @Input() pageSizeOptions: number[] = [5, 10, 20];

  pageSize = 5;
  pageIndex = 0;
  selectedFilter: ActivityFilter = 'all';

  get filteredActivities(): ActivityItem[] {
    if (this.selectedFilter === 'all') {
      return this.activities;
    }
    return this.activities.filter(a => a.type === this.selectedFilter);
  }

  get totalItems(): number {
    return this.filteredActivities.length;
  }

  get totalPages(): number {
    if (this.totalItems === 0) return 1;
    return Math.max(1, Math.ceil(this.totalItems / this.pageSize));
  }

  get pageStart(): number {
    if (this.totalItems === 0) return 0;
    return this.pageIndex * this.pageSize;
  }

  get pageEndExclusive(): number {
    if (this.totalItems === 0) return 0;
    return Math.min(this.totalItems, this.pageStart + this.pageSize);
  }

  get pagedActivities(): ActivityItem[] {
    return this.filteredActivities.slice(this.pageStart, this.pageEndExclusive);
  }

  get canPrev(): boolean {
    return this.pageIndex > 0;
  }

  get canNext(): boolean {
    return this.pageIndex < this.totalPages - 1;
  }

  get articleCount(): number {
    return this.activities.filter(a => a.type === 'article').length;
  }

  get applicationCount(): number {
    return this.activities.filter(a => a.type === 'application').length;
  }

  get issueCount(): number {
    return this.activities.filter(a => a.type === 'issue').length;
  }

  get staffCount(): number {
    return this.activities.filter(a => a.type === 'staff').length;
  }

  setFilter(filter: ActivityFilter): void {
    if (this.selectedFilter === filter) return;
    this.selectedFilter = filter;
    this.pageIndex = 0; // Reset to first page when filter changes
  }

  prevPage(): void {
    if (!this.canPrev) return;
    this.pageIndex -= 1;
  }

  nextPage(): void {
    if (!this.canNext) return;
    this.pageIndex += 1;
  }

  setPageSize(rawValue: string): void {
    const nextSize = Number(rawValue);
    if (!Number.isFinite(nextSize) || nextSize <= 0) return;
    if (nextSize === this.pageSize) return;
    this.pageSize = nextSize;
    this.pageIndex = 0;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activities']) {
      const maxPageIndex = Math.max(0, this.totalPages - 1);
      if (this.pageIndex > maxPageIndex) {
        this.pageIndex = maxPageIndex;
      }
    }
  }

}
