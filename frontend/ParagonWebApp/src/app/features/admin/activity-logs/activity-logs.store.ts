import { computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  debounceTime,
  EMPTY,
  finalize,
  Subject,
  switchMap,
} from 'rxjs';
import {
  ActivityLogsService,
  PaginatedActivityLogs,
} from '../../../core/services/activity-logs.service';
import { SocketService } from '../../../core/services/socket.service';
import {
  ActivityLog,
  ActivityLogFilters,
} from '../../../models/activity-log.model';

export type ActivityLogsLoadStatus =
  | 'idle'
  | 'loading'
  | 'refreshing'
  | 'loaded'
  | 'error';

export type ActivityLogsPaginationItem =
  | number
  | 'ellipsis-start'
  | 'ellipsis-end';

const DEFAULT_PAGE_SIZE = 10;

@Injectable()
export class ActivityLogsStore {
  private readonly activityLogsService = inject(ActivityLogsService);
  private readonly socketService = inject(SocketService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new Subject<void>();
  private readonly realtimeRefresh$ = new Subject<void>();

  private readonly filtersState = signal<ActivityLogFilters>({});

  readonly logs = signal<ActivityLog[]>([]);
  readonly selectedLog = signal<ActivityLog | null>(null);
  readonly status = signal<ActivityLogsLoadStatus>('idle');
  readonly errorMessage = signal('');
  readonly modules = signal<string[]>([]);
  readonly actions = signal<string[]>([]);
  readonly currentPage = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly totalResults = signal(0);
  readonly totalPages = signal(1);

  readonly pageSizeOptions = [10, 25, 50] as const;
  readonly isLoading = computed(
    () => this.status() === 'loading' || this.status() === 'refreshing'
  );
  readonly hasData = computed(() => this.logs().length > 0);
  readonly rangeStart = computed(() => {
    if (!this.hasData() || this.totalResults() === 0) {
      return 0;
    }

    return (this.currentPage() - 1) * this.pageSize() + 1;
  });
  readonly rangeEnd = computed(() => {
    if (!this.hasData() || this.totalResults() === 0) {
      return 0;
    }

    return Math.min(
      this.rangeStart() + this.logs().length - 1,
      this.totalResults()
    );
  });
  readonly paginationItems = computed<ActivityLogsPaginationItem[]>(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const items: ActivityLogsPaginationItem[] = [1];
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);

    if (start > 2) {
      items.push('ellipsis-start');
    }

    for (let page = start; page <= end; page += 1) {
      items.push(page);
    }

    if (end < total - 1) {
      items.push('ellipsis-end');
    }

    items.push(total);
    return items;
  });

  constructor() {
    this.initializeLoading();
    this.initializeRealtime();
  }

  initialize(): void {
    this.loadFilterOptions();
    this.refresh();
  }

  refresh(): void {
    this.reload$.next();
  }

  setFilters(filters: ActivityLogFilters): void {
    this.filtersState.set(this.normalizeFilters(filters));
    this.currentPage.set(1);
    this.refresh();
  }

  goToPage(page: number): void {
    const safePage = Math.min(Math.max(page, 1), this.totalPages());

    if (safePage === this.currentPage() || this.isLoading()) {
      return;
    }

    this.currentPage.set(safePage);
    this.refresh();
  }

  setPageSize(value: string | number): void {
    const nextSize = Number(value);

    if (
      !this.pageSizeOptions.includes(
        nextSize as (typeof this.pageSizeOptions)[number]
      ) ||
      nextSize === this.pageSize() ||
      this.isLoading()
    ) {
      return;
    }

    this.pageSize.set(nextSize);
    this.currentPage.set(1);
    this.refresh();
  }

  selectLog(log: ActivityLog | null): void {
    this.selectedLog.set(log);
  }

  private initializeLoading(): void {
    this.reload$
      .pipe(
        switchMap(() => {
          this.status.set(this.hasData() ? 'refreshing' : 'loading');
          this.errorMessage.set('');

          return this.activityLogsService
            .getLogs({
              ...this.filtersState(),
              page: this.currentPage(),
              limit: this.pageSize(),
            })
            .pipe(
              catchError(error => {
                console.error('Unable to load activity logs:', error);
                this.status.set('error');
                this.errorMessage.set(
                  'Unable to load activity logs. Please try again.'
                );
                return EMPTY;
              }),
              finalize(() => {
                if (this.status() !== 'error') {
                  this.status.set('loaded');
                }
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => this.applyResponse(response));
  }

  private initializeRealtime(): void {
    this.realtimeRefresh$
      .pipe(
        debounceTime(250),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.refresh());

    const removeListener = this.socketService.onActivityLogsUpdated(() => {
      this.realtimeRefresh$.next();
    });

    this.destroyRef.onDestroy(removeListener);
  }

  private loadFilterOptions(): void {
    this.activityLogsService
      .getFilterOptions()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: options => {
          this.modules.set(options.modules);
          this.actions.set(options.actions);
        },
        error: error => {
          console.error('Unable to load activity-log filter options:', error);
        },
      });
  }

  private applyResponse(response: PaginatedActivityLogs): void {
    this.logs.set(response.items);
    this.currentPage.set(response.page);
    this.pageSize.set(response.limit);
    this.totalResults.set(response.total);
    this.totalPages.set(Math.max(response.totalPages, 1));

    const selectedId = this.selectedLog()?.id;
    if (selectedId) {
      this.selectedLog.set(
        response.items.find(log => log.id === selectedId) ?? null
      );
    }
  }

  private normalizeFilters(filters: ActivityLogFilters): ActivityLogFilters {
    return {
      module: filters.module?.trim() || undefined,
      action: filters.action?.trim() || undefined,
      dateFrom: filters.dateFrom?.trim() || undefined,
      search: filters.search?.trim() || undefined,
    };
  }
}
