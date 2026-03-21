import { Component, computed, effect, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ArticleService } from "../../../../../core/services/article.service";
import { Article } from "../../../../../models/article.model";
import { ConfirmationService } from "../../../../../shared/components/confirmation-modal/confirmation.service";
import { ArticleViewModal } from "../../../../../shared/components/article-view-modal/article-view-modal";

type ArticleStatus = 'all' | 'Draft' | 'Published' | 'Archived';
type SortField = 'title' | 'views' | 'status' | 'category';
type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'app-all-articles',
  standalone: true,
  imports: [CommonModule, RouterModule, ArticleViewModal],
  templateUrl: './all-articles.html',
})
export class AllArticlesComponent {

private articleService = inject(ArticleService);
private route = inject(ActivatedRoute);
private router = inject(Router);
private confirm = inject(ConfirmationService);

readonly currentPage = signal(1);
readonly pageSize = signal(5);

readonly searchQuery = signal('');

readonly statuses: ArticleStatus[] = [
  'all',
  'Published',
  'Draft',
  'Archived'
];

readonly selectedArticle = signal<Article | null>(null);

  // ---- Source State ----
  readonly articles = signal<Article[]>([]);

  // ---- Status Filter ----
  readonly statusFilter = signal<ArticleStatus>('all');

  //---- Sort Filter ----
  readonly sortField = signal<SortField>('title')
  readonly sortDirection = signal<SortDirection>('asc');

  //---- Page Size Options ----
  readonly pageSizeOptions = [5, 10, 20, 50];

  constructor() {
    this.reloadArticles();
    // Sync query param → signal
    effect(() => {
      const status = this.route.snapshot.queryParamMap.get('status') as ArticleStatus | null;

      if (status && ['Draft', 'Published', 'Archived'].includes(status)) {
        this.statusFilter.set(status);
      } else {
        this.statusFilter.set('all');
      }
    });
      //reset page when filter/search changes
    effect(() => {
      this.statusFilter();
      this.searchQuery();
      this.sortField();
      this.sortDirection();
      this.currentPage.set(1);
    });

    effect(() => {
      this.pageSize();
      this.currentPage.set(1);
    });
  }

  private reloadArticles(): void {
    this.articleService.getAdminArticles().subscribe({
      next: (articles) => this.articles.set(articles),
      error: (err) => console.error('Failed to load articles', err),
    });
  }

  openArticle(article: Article): void {
    this.selectedArticle.set(article);
  }

  // ---- Computed ----
readonly filteredArticles = computed(() => {
  const status = this.statusFilter();
  const query = this.searchQuery().toLowerCase().trim();
  const list = this.articles();

  return list.filter(article => {

    const matchesStatus =
      status === 'all' || article.status === status;

    const matchesSearch =
      query === '' ||
      article.title.toLowerCase().includes(query) ||
      article.category.toLowerCase().includes(query);

    return matchesStatus && matchesSearch;
  });

});

  readonly total = computed(() => this.articles().length);
  readonly published = computed(() =>
    this.articles().filter(a => a.status === 'Published').length
  );
  readonly drafts = computed(() =>
    this.articles().filter(a => a.status === 'Draft').length
  );
  readonly archived = computed(() =>
    this.articles().filter(a => a.status === 'Archived').length
  );

  // Sorting
  readonly sortedArticles = computed(() => {

  const list = [...this.filteredArticles()];
  const field = this.sortField();
  const direction = this.sortDirection();

  return list.sort((a, b) => {

    let valueA: any;
    let valueB: any;

    switch (field) {
      case 'title':
        valueA = a.title.toLowerCase();
        valueB = b.title.toLowerCase();
        break;

      case 'category':
        valueA = a.category.toLowerCase();
        valueB = b.category.toLowerCase();
        break;

      case 'status':
        valueA = a.status;
        valueB = b.status;
        break;

      case 'views':
        valueA = a.views;
        valueB = b.views;
        break;
    }

    if (valueA < valueB) return direction === 'asc' ? -1 : 1;
    if (valueA > valueB) return direction === 'asc' ? 1 : -1;
    return 0;
  });

});

  //----Total Pages Computed----
  readonly totalPages = computed(() => {
    return Math.max(
      1,
      Math.ceil(this.sortedArticles().length / this.pageSize())
    );
  });

  //---- Paginated Articles Computed ----
  readonly paginatedArticles = computed(() => {

  const page = this.currentPage();
  const size = this.pageSize();
  const list = this.sortedArticles();

  const start = (page - 1) * size;
  const end = start + size;

  return list.slice(start, end);

});

readonly pageNumbers = computed(() =>
  Array.from({ length: this.totalPages() }, (_, i) => i + 1)
)

//---- Range Computed Values ---
readonly totalResults = computed(() =>
  this.sortedArticles().length
);

readonly rangeStart = computed(() => {
  if (this.totalResults() === 0) return 0;
  return (this.currentPage() - 1) * this.pageSize() + 1;
});

readonly rangeEnd = computed(() => {
  const end = this.currentPage() * this.pageSize();
  return Math.min(end, this.totalResults());
});

  // ---- Actions ----
  deleteArticle(id: string): void {
    this.articleService.deleteArticle(id).subscribe({
      next: () => this.reloadArticles(),
      error: (err) => console.error('Failed to delete article', err),
    });
  }

  setStatus(status: ArticleStatus): void {
    this.statusFilter.set(status);

    this.router.navigate([], {
      queryParams: { status: status === 'all' ? null : status },
      queryParamsHandling: 'merge'
    });
  }

  //search method
  onSearch(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  //sort method
  setSort(field: SortField): void {
    if (this.sortField() === field) {
      this.sortDirection.set(
        this.sortDirection() === 'asc' ? 'desc' : 'asc'
      );
    } else {
      this.sortField.set(field);
      this.sortDirection.set('asc');
    }
  }
  onPageSizeChange(event: Event): void {
  const select = event.target as HTMLSelectElement | null;
  if (!select) return;

  this.pageSize.set(+select.value);
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
      next: () => this.reloadArticles(),
      error: (err) => console.error('Failed to archive article', err),
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
