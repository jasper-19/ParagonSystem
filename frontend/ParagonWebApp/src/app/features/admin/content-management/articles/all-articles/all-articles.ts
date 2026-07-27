import { Component, computed, effect, inject, signal, untracked, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import {
  ArticleService,
  AdminArticlesParams,
  AdminArticleDetail,
  AdminArticleSummary,
  AdminArticlesResponse,
} from "../../../../../core/services/article.service";
import { ConfirmationService } from "../../../../../shared/components/confirmation-modal/confirmation.service";
import { ArticleViewModal } from "../../../../../shared/components/article-view-modal/article-view-modal";
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  EMPTY,
  finalize,
  Subject,
  switchMap,
} from "rxjs";

type ArticleStatus = 'all' | 'Draft' | 'Published' | 'Archived';
type ArticleSort = 'latest' | 'oldest' | 'mostViewed';

@Component({
  selector: 'app-all-articles',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleViewModal, FormsModule],
  templateUrl: './all-articles.html',
})
export class AllArticlesComponent {
  private readonly articleService = inject(ArticleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly request$ = new Subject<AdminArticlesParams>();
  private readonly searchInput$ = new Subject<string>();

  readonly currentPage = signal(1);
  readonly pageSize = signal(10);
  readonly searchQuery = signal('');
  readonly sortOrder = signal<ArticleSort>('latest');
  readonly articles = signal<AdminArticlesResponse | null>(null);
  readonly loadError = signal('');

  readonly statuses: ArticleStatus[] = [
    'all',
    'Published',
    'Draft',
    'Archived'
  ];

  readonly selectedArticle = signal<AdminArticleDetail | null>(null);

  readonly modalLoading = signal(false);

  readonly modalError = signal<string | null>(null);

  // ---- Status Filter ----
  readonly statusFilter = signal<ArticleStatus>('all');

  //---- Page Size Options ----
  readonly pageSizeOptions = [5, 10, 20, 50];
  readonly sortOptions: ReadonlyArray<{
    value: ArticleSort;
    label: string;
  }> = [
    { value: 'latest', label: 'Latest first' },
    { value: 'oldest', label: 'Oldest first' },
    { value: 'mostViewed', label: 'Most viewed' },
  ];

  readonly loading = signal(false);

  constructor() {
    this.initializeLoading();
    this.initializeSearch();

    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(params => {
        const status =
          params.get('status');

        const nextStatus: ArticleStatus =
          status === 'Draft' ||
          status === 'Published' ||
          status === 'Archived'
            ? status
            : 'all';

        if (
          this.statusFilter() !== nextStatus
        ) {
          this.currentPage.set(1);
          this.statusFilter.set(nextStatus);
        }
      });

    effect(() => {
      const page =
        this.currentPage();

      const limit =
        this.pageSize();

      const status =
        this.statusFilter();

      const search =
        this.searchQuery()
          .trim();

      const sort = this.sortOrder();

      this.articleService.articlesChanged();

      const params: AdminArticlesParams = {
        page,
        limit,

        status:
          status === 'all'
            ? undefined
            : status,

        search:
          search || undefined,

        sort,
      };

      untracked(() => {
        this.request$.next(params);
      });
    });
  }

  openArticle(article: AdminArticleSummary): void {
    if (this.modalLoading()) {
      return;
    }

    this.modalLoading.set(true);
    this.modalError.set(null);
    this.selectedArticle.set(null);

    this.articleService
      .getAdminArticleDetail(article.id)
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: detail => {
          this.selectedArticle.set(detail);
          this.modalLoading.set(false);
        },

        error: err => {
          console.error(
            'Failed to load article details',
            err
          );

          this.modalError.set(
            err?.error?.error ??
            err?.error?.message ??
            'Failed to load article details. Please try again.'
          );

          this.modalLoading.set(false);
        },
      });
  }

  readonly displayedArticles = computed(
    () => this.articles()?.items ?? []
  );

  readonly total = computed(
    () => this.articles()?.total ?? 0
  );
  readonly published = computed(() =>
    (this.articles()?.items ?? []).filter(
      a => a.status === 'Published'
    ).length
  );
  readonly drafts = computed(() =>
    (this.articles()?.items ?? []).filter(
      a => a.status === 'Draft'
    ).length
  );
  readonly archived = computed(() =>
    (this.articles()?.items ?? []).filter(
      a => a.status === 'Archived'
    ).length
  );

  //----Total Pages Computed----
  readonly totalResults = computed(
    () => this.articles()?.total ?? 0
  );

  readonly totalPages = computed(
    () =>
      Math.max(
        1,
        this.articles()?.totalPages ?? 0
      )
  );

  readonly pageNumbers = computed(() =>
    Array.from(
      {
        length: this.totalPages(),
      },
      (_, index) => index + 1
    )
  );

  private initializeLoading(): void {
    this.request$
      .pipe(
        switchMap(params => {
          this.loading.set(true);
          this.loadError.set('');

          return this.articleService
            .getAdminArticles(params)
            .pipe(
              catchError(err => {
                console.error(
                  'Failed to load admin articles',
                  err
                );
                this.loadError.set(
                  'Unable to load articles. Please try again.'
                );
                return EMPTY;
              }),
              finalize(() => this.loading.set(false))
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(response => {
        this.articles.set(response);

        const lastPage = Math.max(response.totalPages, 1);
        const safePage = Math.min(response.page, lastPage);
        if (safePage !== this.currentPage()) {
          this.currentPage.set(safePage);
        }
      });
  }

  private initializeSearch(): void {
    this.searchInput$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(value => {
        this.currentPage.set(1);
        this.searchQuery.set(value.trim());
      });
  }

  readonly rangeStart = computed(() => {
    if (this.totalResults() === 0) {
      return 0;
    }

    return (
      (this.currentPage() - 1) *
        this.pageSize() +
      1
    );
  });

  readonly rangeEnd = computed(() =>
    Math.min(
      this.currentPage() *
        this.pageSize(),
      this.totalResults()
    )
  );

  readonly visiblePageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();

    if (total <= 5) {
      return Array.from(
        { length: total },
        (_, index) => index + 1
      );
    }

    const start = Math.max(
      1,
      Math.min(current - 2, total - 4)
    );

    return Array.from(
      { length: 5 },
      (_, index) => start + index
    );
  });

  // ---- Actions ----
  deleteArticle(id: string): void {
    this.articleService.deleteArticle(id).subscribe({
      error: (err) => console.error('Failed to delete article', err),
    });
  }

  setStatus(
    status: ArticleStatus
  ): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        status:
          status === 'all'
            ? null
            : status,
      },
      queryParamsHandling: 'merge',
    });
  }

  //search method
  onSearch(event: Event): void {
    const input =
      event.target as HTMLInputElement;

    this.searchInput$.next(input.value);
  }

  onSortChange(sort: ArticleSort): void {
    if (!this.sortOptions.some(option => option.value === sort)) {
      return;
    }

    this.sortOrder.set(sort);
    this.currentPage.set(1);
  }

  retryLoad(): void {
    const status = this.statusFilter();

    this.request$.next({
      page: this.currentPage(),
      limit: this.pageSize(),
      status: status === 'all' ? undefined : status,
      search: this.searchQuery().trim() || undefined,
      sort: this.sortOrder(),
    });
  }

  onPageSizeChange(size: number): void {
    if (
      !Number.isFinite(size) ||
      !this.pageSizeOptions.includes(size)
    ) {
      return;
    }

    this.pageSize.set(size);
    this.currentPage.set(1);
  }

  goToPage(page: number): void {
    const safePage = Math.min(
      Math.max(page, 1),
      this.totalPages()
    );

    if (
      this.loading() ||
      safePage === this.currentPage()
    ) {
      return;
    }

    this.currentPage.set(safePage);
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

  closeArticleModal(): void {
    this.selectedArticle.set(null);
    this.modalError.set(null);
    this.modalLoading.set(false);
  }
  //request archive
  async requestArchive(article: AdminArticleSummary): Promise<void> {
    if (article.status === 'Archived') return;
    const ok = await this.confirm.confirm({
      title: 'Archive Article',
      message: `Are you sure you want to archive ${article.title}?`,
      confirmText: 'Archive',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    this.articleService.archiveArticle(article.id).subscribe({
      error: (err) =>
        console.error('Failed to archive article', err),
    });

  }

  async requestDelete(article: AdminArticleSummary): Promise<void> {
    if (article.status !== 'Archived') return;

    const ok = await this.confirm.confirm({
      title: 'Delete Article',
      message: `Delete ${article.title} permanently? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
    });

    if (!ok) return;

    this.deleteArticle(article.id);
  }
}
