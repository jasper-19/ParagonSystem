import {
  Component,
  signal,
  computed,
  effect,
  inject,
  DestroyRef,
  untracked,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';

import { Article } from '../../models/article.model';
import {
  GetArticlesParams,
  ArticleSortOption
} from '../../models/article-query.model';

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

private readonly articleService = inject(ArticleService);
private readonly destroyRef = inject(DestroyRef);

private loader = inject(LoaderService);

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

  readonly categories = toSignal(
    this.articleService.getCategories(),
    { initialValue: [] }
  );

  //AVAILABLE TAGS (Observable → Signal)
  readonly tags = toSignal(
  this.articleService.getTags(),
  { initialValue: [] }
);

  // -----------------------------------------
  // 📄 PAGINATION STATE
  // -----------------------------------------

  readonly currentPage = signal<number>(1);
  readonly limit = 6;

  readonly hasMore = signal<boolean>(true);
  readonly loading = signal<boolean>(false);
  readonly total = signal<number>(0);

  // -----------------------------------------
  // 📰 ARTICLE STATE
  // -----------------------------------------

  readonly articles = signal<Article[]>([]);

  // -----------------------------------------
  // 🧠 COMPUTED FILTER OBJECT
  // -----------------------------------------

  //LOADING STATE
  readonly initialLoading = signal<boolean>(true);

  readonly loadingMore = signal<boolean>(false);

private initialized = false;

constructor() {
  effect(() => {
    this.filters();

    untracked(() => {
      this.resetAndLoad();
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

    if (this.loading() || !this.hasMore()) return;

    this.loading.set(true)

    if (this.initialLoading()){
       this.loader.show(); // Show loader with a timeout of 3 seconds
    } else {
        this.loadingMore.set(true);
    }


    const params: GetArticlesParams = {
      page: this.currentPage(),
      limit: this.limit,
      search: this.search(),
      category: this.selectedCategory(),
      sort: this.sort(),
      tags: this.selectedTags()
    };

  this.articleService.getArticles(params)
    .subscribe({
      next: (articles) => {

        // Append results
        this.articles.update(prev => [
          ...prev,
          ...articles
        ]);

        this.total.set(this.articles().length);

        const loaded = this.articles().length;

        this.hasMore.set(articles.length === this.limit);

        this.currentPage.update(p => p + 1);

        this.loading.set(false);

        if (this.initialLoading()) {
          this.loader.hide();
          this.initialLoading.set(false);
        } else {
          this.loadingMore.set(false);
        }
      },

      error: () => {
        this.loading.set(false);

        if (this.initialLoading()) {
          this.loader.hide();
          this.initialLoading.set(false);
        } else {
          this.loadingMore.set(false);
        }
      }
    });
  }

  // -----------------------------------------
  // 🔄 RESET PAGINATION
  // -----------------------------------------

  private resetAndLoad(): void {

    this.currentPage.set(1);
    this.articles.set([]);
    this.hasMore.set(true);

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
}
