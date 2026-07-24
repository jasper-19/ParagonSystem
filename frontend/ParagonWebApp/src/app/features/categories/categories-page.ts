import { Component, signal, computed, effect, inject, DestroyRef, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { GetArticlesParams, ArticleSortOption } from '../../models/article-query.model';
import { ArticleService } from '../../core/services/article.service';
import { CategoriesHero } from './components/hero-section/categories-hero';
import { CategoriesArticles } from './components/articles-section/categories-articles';
import { LoaderService } from '../../shared/services/loader.service';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    CategoriesHero,
    CategoriesArticles
  ],
  templateUrl: './categories-page.html'
})
export class CategoriesPage {

  private lastArticleChangeVersion = 0;

  private readonly articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly loader = inject(LoaderService);

  private readonly reloadPending = signal(false);
  // -----------------------------------------
  // 🔎 FILTER STATE
  // -----------------------------------------

  readonly search = signal<string>('');
  readonly selectedCategory = signal<string | undefined>(undefined);
  readonly sort = signal<ArticleSortOption>('latest');
  readonly selectedTags = signal<string[]>([]);

  // -----------------------------------------
  // 📂 AVAILABLE CATEGORIES (Observable → Signal)
  // -----------------------------------------

  readonly categoryFeed = this.articleService.categoryFeed;

  readonly articles = this.articleService.categoryArticles;

  readonly categories = computed(() =>
    this.categoryFeed()?.categories ?? []
  );

  readonly tags = computed(() =>
    this.categoryFeed()?.tags ?? []
  );

  readonly hasMore = computed(() =>
    this.categoryFeed()?.hasMore ?? true
  );

  readonly total = computed(() =>
    this.articles().length
  );

  readonly visibleTags = computed(() =>
    this.tags()
      .filter(tag => tag.trim().length > 0)
      .slice(0, 12)
  );

  // -----------------------------------------
  // 📄 PAGINATION STATE
  // -----------------------------------------

  readonly currentPage = signal<number>(1);
  readonly limit = 6;

  readonly loading = signal<boolean>(false);

  // -----------------------------------------
  // 📰 ARTICLE STATE
  // -----------------------------------------


  // -----------------------------------------
  // 🧠 COMPUTED FILTER OBJECT
  // -----------------------------------------

  //LOADING STATE
  readonly initialLoading = signal<boolean>(true);

  readonly loadingMore = signal<boolean>(false);

  constructor() {
    this.route.queryParamMap
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(params => {
        const category =
          params.get('category');

        this.selectedCategory.set(
          category || undefined
        );
      });

    /*
    * Reload when filters change.
    */
    effect(() => {
      this.filters();

      untracked(() => {
        this.resetAndLoad(true);
      });
    });

    /*
    * Reload when an article is created, updated,
    * published, archived, or deleted.
    */
    effect(() => {
      const version =
        this.articleService.articlesChanged();

      if (
        version === 0 ||
        version === this.lastArticleChangeVersion
      ) {
        return;
      }

      this.lastArticleChangeVersion = version;

      untracked(() => {
        this.resetAndLoad(false);
      });
    });
  }

  private readonly filters = computed(() => ({
    search: this.search(),
    category: this.selectedCategory(),
    sort: this.sort(),
    tags: this.selectedTags()
  }));



  // -----------------------------------------
  // 🚀 LOAD ARTICLES
  // -----------------------------------------

  private loadArticles(): void {
    const isFirstPage =
      this.currentPage() === 1;

    if (this.loading()) {
      this.reloadPending.set(true);
      return;
    }

    if (
      !isFirstPage &&
      !this.hasMore()
    ) {
      return;
    }

    this.loading.set(true);

    const params: GetArticlesParams = {
      page: this.currentPage(),
      limit: this.limit,
      search: this.search(),
      category: this.selectedCategory(),
      sort: this.sort(),
      tags: this.selectedTags(),
    };

    this.articleService.loadCategoryFeed(params).subscribe({
      next: () => {
        this.currentPage.update(
          page => page + 1
        );

        this.loading.set(false);

        if (this.initialLoading()) {
          this.loader.hide();
          this.initialLoading.set(false);
        } else {
          this.loadingMore.set(false);
        }

        if (this.reloadPending()) {
          this.reloadPending.set(false);
          this.resetAndLoad(false);
        }
      },
      error: err => {
        console.error(
          'Failed to load category feed',
          err
        );

        this.loading.set(false);

        if (this.initialLoading()) {
          this.loader.hide();
          this.initialLoading.set(false);
        } else {
          this.loadingMore.set(false);
        }

        if (this.reloadPending()) {
          this.reloadPending.set(false);
          this.resetAndLoad(false);
        }
      },
    });
  }

  // -----------------------------------------
  // 🔄 RESET PAGINATION
  // -----------------------------------------

  private resetAndLoad(
    showPageLoader: boolean
  ): void {
    this.currentPage.set(1);

    if (showPageLoader) {
      this.initialLoading.set(true);
    } else {
      this.initialLoading.set(false);
      this.loadingMore.set(false);
    }

    this.loadArticles();
  }

  // -----------------------------------------
  // 📩 FILTER EVENTS
  // -----------------------------------------

  onFiltersChange(filters: {
    search: string;
    category?: string;
    sort: ArticleSortOption;
  }): void {

    this.search.set(filters.search);
    this.selectedCategory.set(filters.category);
    this.sort.set(filters.sort);
  }

  // -----------------------------------------
  // 📩 INFINITE SCROLL EVENT
  // -----------------------------------------

  onLoadMore(): void {
    this.loadArticles();
  }

  setSort(value: string): void {
  this.sort.set(value as ArticleSortOption);
  }

  toggleTag(tag: string): void {
  const current = this.selectedTags();

  if (current.includes(tag)) {
    this.selectedTags.set(current.filter(t => t !== tag));
  } else {
    this.selectedTags.set([...current, tag]);
  }
}

  setCategory(category?: string): void {
    this.selectedCategory.set(category);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: category || null,
      },
      queryParamsHandling: 'merge',
    });
  }

  clearFilters(): void {
    this.search.set('');
    this.sort.set('latest');
    this.selectedCategory.set(undefined);
    this.selectedTags.set([]);

    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: null,
      },
      queryParamsHandling: 'merge',
    });
  }

  formatTag(tag: string): string {
    return tag
      .trim()
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }
}
