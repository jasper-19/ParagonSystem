import { Component, OnInit, signal, OnDestroy, HostListener, ViewChild } from "@angular/core";
import { Subject, switchMap, EMPTY, catchError, finalize, takeUntil, debounceTime } from "rxjs";
import { ActivityLogsService } from "../../../core/services/activity-logs.service";
import { ActivityLog, ActivityLogFilters } from "../../../models/activity-log.model";
import { RouterModule } from "@angular/router";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivityLogTableComponent } from "./components/activity-log-table";
import { ActivityLogFiltersComponent, ActivityLogFilters as ActivityLogFiltersEvent } from "./components/activity-log-filters";
import { ActivityLogDetailsModalComponent } from "../../../shared/components/activity-log-details-modal/activity-log-details-modal";
import { SocketService, ActivityLogsUpdatedPayload } from "../../../core/services/socket.service";

type PaginationItem = | number | 'ellipsis-start' | 'ellipsis-end';

@Component({
  selector: 'app-activity-logs',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule,
    ActivityLogTableComponent,
    ActivityLogFiltersComponent,
    ActivityLogDetailsModalComponent,
  ],
  templateUrl: './activity-logs.html',
})
export class ActivityLogsComponent implements OnInit, OnDestroy {

  @ViewChild(
    ActivityLogFiltersComponent
  )
  private filtersComponent?:
    ActivityLogFiltersComponent;

  readonly logs = signal<ActivityLog[]>([]);
  readonly selectedLog = signal<ActivityLog | null>(null);
  readonly isLoading = signal(false);
  readonly errorMessage = signal('');
  readonly modules = signal<string[]>([]);
  readonly actions = signal<string[]>([]);
  private filters: ActivityLogFilters = {};

  readonly skeletonRows =
    Array.from(
      { length: 8 },
      (_, index) => index
    );

  private readonly realtimeRefresh$ =
    new Subject<void>();

  private readonly destroy$ =
    new Subject<void>();

  private readonly reload$ =
    new Subject<ActivityLogFilters>();

  // Pagination state
  readonly pageSizeOptions =
    [10, 25, 50];
  readonly pageSize = signal(10);
  readonly currentPage = signal(1);

  constructor(
    private activityLogsService: ActivityLogsService,
    private socketService: SocketService
  ) { }

  ngOnInit(): void {
    this.initializeLogLoading();
    this.initializeRealtime();
    this.loadFilterOptions();
    this.loadLogs();
  }

  ngOnDestroy(): void {
    this.removeActivityLogsListener
      ?.();

    this.removeActivityLogsListener =
      null;

    this.destroy$.next();
    this.destroy$.complete();
  }

  loadFilterOptions(): void {
    this.activityLogsService
      .getFilterOptions()
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe({
        next: options => {
          this.modules.set([
            ...options.modules,
          ]);

          this.actions.set([
            ...options.actions,
          ]);
        },

        error: error => {
          console.error(
            'Unable to load activity-log filter options:',
            error
          );
        },
      });
  }

  loadLogs(): void {
    this.reload$.next({
      ...this.filters,
    });
  }

  onFiltersChange(
    filters: ActivityLogFiltersEvent
  ): void {
    this.filters = {
      module:
        filters.module?.trim() ||
        undefined,

      action:
        filters.action?.trim() ||
        undefined,

      dateFrom:
        filters.dateFrom?.trim() ||
        undefined,

      search:
        filters.search?.trim() ||
        undefined,
    };

    this.currentPage.set(1);
    this.loadLogs();
  }

  private initializeLogLoading(): void {
    this.reload$
      .pipe(
        switchMap(filters => {
          this.isLoading.set(true);
          this.errorMessage.set('');

          return this.activityLogsService
            .getLogs({
              ...filters,
              page:
                this.currentPage(),
              limit:
                this.pageSize(),
            })
            .pipe(
              catchError(error => {
                console.error(
                  'Unable to load activity logs:',
                  error
                );

                this.logs.set([]);
                this.totalResults.set(0);
                this.totalPages.set(1);

                this.errorMessage.set(
                  'Unable to load activity logs. Please try again.'
                );

                return EMPTY;
              }),

              finalize(() => {
                this.isLoading.set(false);
              })
            );
        }),

        takeUntil(this.destroy$)
      )
      .subscribe(response => {
        this.logs.set(
          response.items
        );

        this.currentPage.set(
          response.page
        );

        this.pageSize.set(
          response.limit
        );

        this.totalResults.set(
          response.total
        );

        this.totalPages.set(
          response.totalPages
        );
      });
  }

  goToPage(
    page: number
  ): void {
    const safePage =
      Math.min(
        Math.max(page, 1),
        this.totalPages()
      );

    if (
      safePage ===
      this.currentPage() ||
      this.isLoading()
    ) {
      return;
    }

    this.currentPage.set(
      safePage
    );

    this.loadLogs();
  }

  goToPreviousPage(): void {
    this.goToPage(
      this.currentPage() - 1
    );
  }

  goToNextPage(): void {
    this.goToPage(
      this.currentPage() + 1
    );
  }

  // Derived values / helpers
  readonly totalResults =
    signal(0);

  readonly totalPages =
    signal(1);

  rangeStart(): number {
    if (
      this.totalResults() === 0 ||
      this.logs().length === 0
    ) {
      return 0;
    }

    return (
      (
        this.currentPage() - 1
      ) *
      this.pageSize()
    ) + 1;
  }

  rangeEnd(): number {
    if (
      this.totalResults() === 0 ||
      this.logs().length === 0
    ) {
      return 0;
    }

    return Math.min(
      this.rangeStart() +
        this.logs().length -
        1,
      this.totalResults()
    );
  }

  private isTypingTarget(
    target: EventTarget | null
  ): boolean {
    if (
      !(target instanceof HTMLElement)
    ) {
      return false;
    }

    const tagName =
      target.tagName.toLowerCase();

    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }

  trackPaginationItem(
    _index: number,
    item: PaginationItem
  ): string {
    return String(item);
  }

  paginationItems(): PaginationItem[] {
    const total =
      this.totalPages();

    const current =
      this.currentPage();

    if (total <= 7) {
      return Array.from(
        { length: total },
        (_, index) => index + 1
      );
    }

    const items:
      PaginationItem[] = [1];

    const start =
      Math.max(
        2,
        current - 1
      );

    const end =
      Math.min(
        total - 1,
        current + 1
      );

    if (start > 2) {
      items.push(
        'ellipsis-start'
      );
    }

    for (
      let page = start;
      page <= end;
      page += 1
    ) {
      items.push(page);
    }

    if (end < total - 1) {
      items.push(
        'ellipsis-end'
      );
    }

    items.push(total);

    return items;
  }

  onPageSizeChange(
    value: string | number
  ): void {
    const nextSize =
      Number(value);

    if (
      !this.pageSizeOptions.includes(
        nextSize
      ) ||
      nextSize === this.pageSize() ||
      this.isLoading()
    ) {
      return;
    }

    this.pageSize.set(nextSize);
    this.currentPage.set(1);

    this.loadLogs();
  }

  viewDetails(log: ActivityLog): void {
    this.selectedLog.set(log);
  }

  closeModal(): void {
    this.selectedLog.set(null);
  }

  private removeActivityLogsListener:
    (() => void) | null = null;

  private initializeRealtime(): void {
    this.realtimeRefresh$
      .pipe(
        debounceTime(200),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        this.loadLogs();
      });

    this.removeActivityLogsListener =
      this.socketService
        .onActivityLogsUpdated(
          () => {
            this.realtimeRefresh$.next();
          }
        );
  }

  @HostListener(
    'document:keydown',
    ['$event']
  )
  onDocumentKeydown(
    event: KeyboardEvent
  ): void {
    if (
      event.defaultPrevented
    ) {
      return;
    }

    const typing =
      this.isTypingTarget(
        event.target
      );

    // Focus Search
    if (
      event.key === '/' &&
      !typing &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();

      this.filtersComponent
        ?.focusSearch();

      return;
    }

    // Do not paginate while:
    // - typing in a control;
    // - viewing the details modal;
    // - loading;
    // - holding modifier keys.
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

    if (
      event.key === 'ArrowLeft' &&
      this.currentPage() > 1
    ) {
      event.preventDefault();
      this.goToPreviousPage();
      return;
    }

    if (
      event.key === 'ArrowRight' &&
      this.currentPage() <
        this.totalPages()
    ) {
      event.preventDefault();
      this.goToNextPage();
    }
  }

}
