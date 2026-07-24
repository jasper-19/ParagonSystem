import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';

export interface ActivityLogFilters {
  module?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

@Component({
  selector: 'app-activity-log-filters',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './activity-log-filters.html',
  host: { class: 'block' },
})
export class ActivityLogFiltersComponent implements OnDestroy {

  @ViewChild(
    'searchInput'
  )
  private searchInput?: ElementRef<HTMLInputElement>;

  @Input() modules: string[] = [];
  @Input() actions: string[] = [];
  @Input() loading = false;

  @Output() filtersChange = new EventEmitter<ActivityLogFilters>();

  filters: ActivityLogFilters = {
    module: '',
    action: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  };

  private readonly destroy$ =
    new Subject<void>();

  private readonly searchChange$ =
    new Subject<string>();

  constructor() {
    this.searchChange$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntil(this.destroy$)
      )
      .subscribe(search => {
        if (
          search !==
          this.filters.search
        ) {
          return;
        }

        this.emitFilters(search);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onFilterChange(): void {
    if (this.loading) {
      return;
    }

    this.emitFilters();
  }

  onSearchChange(
    value: string
  ): void {
    if (this.loading) {
      return;
    }

    this.searchChange$.next(value);
  }

  clearFilters(): void {
    if (this.loading) {
      return;
    }
    this.filters = {
      module: '',
      action: '',
      dateFrom: '',
      search: '',
    };

    this.emitFilters();
  }

  focusSearch(): void {
    if (this.loading) {
      return;
    }

    const input =
      this.searchInput?.nativeElement;

    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }

  get hasActiveFilters(): boolean {
    return Boolean(
      this.filters.module ||
      this.filters.action ||
      this.filters.dateFrom ||
      this.filters.search?.trim()
    );
  }

  //Helpers
  private emitFilters(
    searchOverride:
      string | undefined =
        this.filters.search
  ): void {
    this.filtersChange.emit({
      module:
        this.filters.module?.trim() ||
        undefined,

      action:
        this.filters.action?.trim() ||
        undefined,

      dateFrom:
        this.filters.dateFrom?.trim() ||
        undefined,

      search:
        searchOverride?.trim() ||
        undefined,
    });
  }
}
