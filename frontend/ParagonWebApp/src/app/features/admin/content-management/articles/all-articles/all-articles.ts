import { Component, computed, effect, inject, signal, untracked, DestroyRef } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormsModule } from "@angular/forms";
import { ArticleService, AdminArticlesParams, AdminArticleDetail } from "../../../../../core/services/article.service";
import { Article } from "../../../../../models/article.model";
import { ConfirmationService } from "../../../../../shared/components/confirmation-modal/confirmation.service";
import { ArticleViewModal } from "../../../../../shared/components/article-view-modal/article-view-modal";

type ArticleStatus = 'all' | 'Draft' | 'Published' | 'Archived';

@Component({
  selector: 'app-all-articles',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleViewModal, FormsModule],
  templateUrl: './all-articles.html',
})
export class AllArticlesComponent {

private loadArticles(
  params: AdminArticlesParams
): void {
  this.loading.set(true);

  this.articleService
    .getAdminArticles(params)
    .subscribe({
      next: response => {
        if (
          this.currentPage() !== response.page
        ) {
          this.currentPage.set(
            response.page
          );
        }

        this.loading.set(false);
      },

      error: err => {
        console.error(
          'Failed to load admin articles',
          err
        );

        this.loading.set(false);
      },
    });
}

  private searchTimer?: ReturnType<
    typeof setTimeout
  >;

  private readonly articleService = inject(ArticleService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);

  readonly currentPage = signal(1);
  readonly pageSize = signal(5);

  readonly searchQuery = signal('');

  readonly statuses: ArticleStatus[] = [
    'all',
    'Published',
    'Draft',
    'Archived'
  ];

  readonly selectedArticle = signal<AdminArticleDetail | null>(null);

  readonly modalLoading = signal(false);

  readonly modalError = signal<string | null>(null);

  // ---- Source State ----
  readonly articles = this.articleService.adminArticles;

  // ---- Status Filter ----
  readonly statusFilter = signal<ArticleStatus>('all');

  //---- Page Size Options ----
  readonly pageSizeOptions = [5, 10, 20, 50];

  readonly loading = signal(false);

  constructor() {
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

        sort: 'latest',
      };

      untracked(() => {
        this.loadArticles(params);
      });
    });
  }

  openArticle(article: Article): void {
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

    const value = input.value;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.currentPage.set(1);
      this.searchQuery.set(value);
    }, 300);
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
  async requestArchive(article: Article): Promise<void> {
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

  async requestDelete(article: Article): Promise<void> {
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
