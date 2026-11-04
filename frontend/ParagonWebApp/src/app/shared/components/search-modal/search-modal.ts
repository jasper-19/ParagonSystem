import {
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  EventEmitter,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  Output,
  untracked,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { catchError, debounceTime, map, switchMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../models/article.model';
import { imageVariant } from '../../utils/image-variant.util';

type SearchMode =
  | 'idle'
  | 'query'
  | 'category';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-modal.html',
  styleUrl: './search-modal.scss'
})
export class SearchModal implements OnInit, AfterViewInit, OnDestroy {
  protected readonly imageVariant = imageVariant;

  private readonly destroyRef = inject(DestroyRef);

  @Output() close = new EventEmitter<void>();

  @ViewChild('searchInput')
  searchInput!: ElementRef<HTMLInputElement>;

  @ViewChild('dialogPanel')
  dialogPanel!: ElementRef<HTMLElement>;

  private articleService = inject(ArticleService);
  private router = inject(Router);
  private previouslyFocusedElement: HTMLElement | null = null;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private interactionVersion = 0;

  private searchMode: SearchMode = 'idle';
  private runTextSearch(
    query: string,
    showLoading = true
  ): void {
    const term = query.trim();

    if (term.length < 2) {
      this.results = [];
      this.hasSearched = false;
      this.isLoading = false;
      this.searchMode = 'idle';
      return;
    }

    const version = ++this.interactionVersion;
    this.searchError = false;
    this.searchMode = 'query';
    this.hasSearched = true;

    if (showLoading) {
      this.isLoading = true;
    }

    this.articleService
      .searchArticles(term)
      .pipe(
        catchError(err => {
          if (version === this.interactionVersion) this.searchError = true;
          console.error(
            'Failed to search articles',
            err
          );

          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(articles => {
        if (version !== this.interactionVersion) {
          return;
        }

        this.results = articles;
        this.isLoading = false;
      });
  }


  readonly recentArticles = computed(() =>
    this.searchFeed()?.recent ?? []
  );

  readonly categories = computed(() =>
    this.searchFeed()?.categories ?? []
  );

  query = '';
  results: Article[] = [];
  isLoading = false;
  hasSearched = false;
  searchError = false;
  isFeedLoading = false;
  feedError = false;

  readonly searchFeed = this.articleService.searchFeed;

  private search$ = new Subject<{ value: string; version: number }>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        tap(({ value, version }) => {
          if (version !== this.interactionVersion) {
            return;
          }

          const query = value.trim();

          if (query.length < 2) {
            this.results = [];
            this.hasSearched = false;
            this.isLoading = false;
            this.searchMode = 'idle';
            return;
          }

          this.isLoading = true;
          this.hasSearched = true;
          this.searchMode = 'query';
        }),
        switchMap(({ value, version }) => {
          const query = value.trim();

          if (version !== this.interactionVersion || query.length < 2) {
            return of({ articles: [] as Article[], version });
          }

          return this.articleService
            .searchArticles(query)
            .pipe(
              map(articles => ({ articles, version })),
              catchError(err => {
                if (version === this.interactionVersion) this.searchError = true;
                console.error(
                  'Failed to search articles',
                  err
                );

                return of({ articles: [] as Article[], version });
              })
            );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(({ articles, version }) => {
        if (version !== this.interactionVersion) {
          return;
        }

        this.results = articles;
        this.isLoading = false;
      });

    effect(() => {
      const version =
        this.articleService.articlesChanged();

      if (version === 0) {
        return;
      }

      untracked(() => {
        this.refreshCurrentResults();
      });
    });
  }

  ngOnInit(): void {
    this.loadBrowseFeed();
  }

  loadBrowseFeed(): void {
    this.isFeedLoading = true;
    this.feedError = false;
    this.articleService.getSearchFeed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.isFeedLoading = false; },
      error: () => { this.isFeedLoading = false; this.feedError = true; },
    });
  }

  retrySearch(): void {
    if (this.selectedCategory) this.runCategorySearch(this.selectedCategory);
    else this.runTextSearch(this.query);
  }

  ngAfterViewInit(): void {
    this.previouslyFocusedElement = document.activeElement as HTMLElement | null;

    this.focusTimer = setTimeout(() => {
      this.searchInput?.nativeElement.focus();
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.focusTimer);
    setTimeout(() => this.previouslyFocusedElement?.focus());
  }

  onSearchChange(value: string): void {
    this.query = value;
    this.selectedCategory = null;
    const version = ++this.interactionVersion;
    this.searchError = false;

    if (value.trim().length < 2) {
      this.results = [];
      this.hasSearched = false;
      this.isLoading = false;
      this.searchMode = 'idle';
    } else {
      this.hasSearched = true;
      this.isLoading = true;
      this.searchMode = 'query';
    }

    this.search$.next({ value, version });
  }

  clearSearch(): void {
    this.onSearchChange('');
    this.searchInput?.nativeElement.focus();
  }

  openArticle(article: Article): void {
    this.close.emit();
    this.router.navigate(['/article', article.slug]);
  }

  selectedCategory: string | null = null;

  selectCategory(category: string): void {
    this.interactionVersion++;
    this.selectedCategory = category;
    this.query = category;

    this.runCategorySearch(category);
  }

  closeModal(): void {
    this.close.emit();
  }

  onBackdropClick(): void {
    this.closeModal();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closeModal();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = this.dialogPanel?.nativeElement.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements?.length) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private refreshCurrentResults(): void {
    if (
      this.searchMode === 'query' &&
      this.query.trim().length >= 2
    ) {
      this.runTextSearch(
        this.query,
        false
      );

      return;
    }

    if (
      this.searchMode === 'category' &&
      this.selectedCategory
    ) {
      this.runCategorySearch(
        this.selectedCategory,
        false
      );
    }
  }

  private runCategorySearch(
    category: string,
    showLoading = true
  ): void {
    const version = ++this.interactionVersion;
    this.searchError = false;
    this.searchMode = 'category';
    this.hasSearched = true;

    if (showLoading) {
      this.isLoading = true;
    }

    this.articleService
      .getArticles({
        page: 1,
        limit: 12,
        category: category as any,
        sort: 'latest',
      })
      .pipe(
        catchError(err => {
          if (version === this.interactionVersion) this.searchError = true;
          console.error(
            'Failed to load category search results',
            err
          );

          return of([]);
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(articles => {
        if (version !== this.interactionVersion) {
          return;
        }

        this.results = articles;
        this.isLoading = false;
      });
  }

}
