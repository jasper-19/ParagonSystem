import {
  Component,
  HostListener,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ActivityLog } from '../../../models/activity-log.model';
import { ActivityLogDetailsModalComponent } from '../../../shared/components/activity-log-details-modal/activity-log-details-modal';
import {
  ActivityLogFilters as ActivityLogFiltersEvent,
  ActivityLogFiltersComponent,
} from './components/activity-log-filters';
import { ActivityLogTableComponent } from './components/activity-log-table';
import {
  ActivityLogsPaginationItem,
  ActivityLogsStore,
} from './activity-logs.store';

@Component({
  selector: 'app-activity-logs',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ActivityLogTableComponent,
    ActivityLogFiltersComponent,
    ActivityLogDetailsModalComponent,
  ],
  providers: [ActivityLogsStore],
  templateUrl: './activity-logs.html',
})
export class ActivityLogsComponent implements OnInit {
  @ViewChild(ActivityLogFiltersComponent)
  private filtersComponent?: ActivityLogFiltersComponent;

  private readonly store = inject(ActivityLogsStore);

  readonly logs = this.store.logs;
  readonly selectedLog = this.store.selectedLog;
  readonly isLoading = this.store.isLoading;
  readonly errorMessage = this.store.errorMessage;
  readonly modules = this.store.modules;
  readonly actions = this.store.actions;
  readonly pageSizeOptions = this.store.pageSizeOptions;
  readonly pageSize = this.store.pageSize;
  readonly currentPage = this.store.currentPage;
  readonly totalResults = this.store.totalResults;
  readonly totalPages = this.store.totalPages;
  readonly rangeStart = this.store.rangeStart;
  readonly rangeEnd = this.store.rangeEnd;

  readonly skeletonRows = Array.from({ length: 8 }, (_, index) => index);

  ngOnInit(): void {
    this.store.initialize();
  }

  loadLogs(): void {
    this.store.refresh();
  }

  onFiltersChange(filters: ActivityLogFiltersEvent): void {
    this.store.setFilters(filters);
  }

  goToPage(page: number): void {
    this.store.goToPage(page);
  }

  goToPreviousPage(): void {
    this.store.goToPage(this.currentPage() - 1);
  }

  goToNextPage(): void {
    this.store.goToPage(this.currentPage() + 1);
  }

  trackPaginationItem(
    _index: number,
    item: ActivityLogsPaginationItem
  ): string {
    return String(item);
  }

  paginationItems(): ActivityLogsPaginationItem[] {
    return this.store.paginationItems();
  }

  onPageSizeChange(value: string | number): void {
    this.store.setPageSize(value);
  }

  viewDetails(log: ActivityLog): void {
    this.store.selectLog(log);
  }

  closeModal(): void {
    this.store.selectLog(null);
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }

    const typing = this.isTypingTarget(event.target);

    if (
      event.key === '/' &&
      !typing &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      this.filtersComponent?.focusSearch();
      return;
    }

    if (
      typing ||
      this.selectedLog() ||
      this.isLoading() ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    ) {
      return;
    }

    if (event.key === 'ArrowLeft' && this.currentPage() > 1) {
      event.preventDefault();
      this.goToPreviousPage();
      return;
    }

    if (event.key === 'ArrowRight' && this.currentPage() < this.totalPages()) {
      event.preventDefault();
      this.goToNextPage();
    }
  }
}
