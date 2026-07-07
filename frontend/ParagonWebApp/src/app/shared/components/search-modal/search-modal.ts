import { Component, EventEmitter, Output, inject, OnInit, ElementRef, ViewChild, AfterViewInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../models/article.model';
import { imageVariant } from '../../utils/image-variant.util';
import { ImagePlaceholderComponent } from '../image-placeholder/image-placeholder';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, ImagePlaceholderComponent],
  templateUrl: './search-modal.html'
})
export class SearchModal implements OnInit, AfterViewInit {
  protected readonly imageVariant = imageVariant;

  private readonly sanitizer = inject(DomSanitizer);

  @Output() close = new EventEmitter<void>();

  @ViewChild('searchInput')
  searchInput!: ElementRef<HTMLInputElement>;

  private articleService = inject(ArticleService);
  private router = inject(Router);

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

  readonly searchFeed = this.articleService.searchFeed;

  private search$ = new Subject<string>();

  constructor() {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap(() => {
          this.isLoading = true;
          this.hasSearched = true;
        }),
        switchMap((term) => {
          const q = term.trim();

          if (q.length < 2) {
            this.isLoading = false;
            this.hasSearched = false;
            return of([]);
          }

          return this.articleService.searchArticles(q).pipe(
            catchError(() => of([]))
          );
        })
      )
      .subscribe((articles) => {
        this.results = articles;
        this.isLoading = false;
      });
  }

  ngOnInit(): void {
    this.articleService.loadSearchFeed();
  }

  ngAfterViewInit(): void {
    // Small delay ensures the modal animation/layout is complete
    setTimeout(() => {
      this.searchInput?.nativeElement.focus();
    });
  }

  onSearchChange(value: string): void {
    this.query = value;
    this.selectedCategory = null; // Reset selected category when typing a new query
    this.search$.next(value);
  }

  openArticle(article: Article): void {
    this.close.emit();
    this.router.navigate(['/article', article.slug]);
  }

  selectedCategory: string | null = null;

  selectCategory(category: string): void {
    this.selectedCategory = category;
    this.query = category;
    this.hasSearched = true;
    this.isLoading = true;

    this.articleService.getArticles({
      page: 1,
      limit: 12,
      category: category as any,
      sort: 'latest',
    }).subscribe({
      next: (articles) => {
        this.results = articles;
        this.isLoading = false;
      },
      error: () => {
        this.results = [];
        this.isLoading = false;
      }
    });
  }

  onBackdropClick(): void {
    this.close.emit();
  }

  getCategoryIcon(category: string): SafeHtml {

    const key = category.toLowerCase();

    return (
      this.categoryIcons[key] ??
      this.categoryIcons['news']
    );

  }

private readonly categoryIcons: Record<string, SafeHtml> = {
  news: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <path d="M15 18h-5"/>
      <path d="M18 14h-8"/>
      <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/>
      <rect width="8" height="4" x="10" y="6" rx="1"/>
    </svg>
  `),

  sports: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978"/>
      <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978"/>
      <path d="M18 9h1.5a1 1 0 0 0 0-5H18"/>
      <path d="M4 22h16"/>
      <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z"/>
      <path d="M6 9H4.5a1 1 0 0 1 0-5H6"/>
    </svg>
  `),

  feature: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/>
      <path d="M20 2v4"/>
      <path d="M22 4h-4"/>
      <circle cx="4" cy="20" r="2"/>
    </svg>
  `),

  // column
  column: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <path d="M15.707 21.293a1 1 0 0 1-1.414 0l-1.586-1.586a1 1 0 0 1 0-1.414l5.586-5.586a1 1 0 0 1 1.414 0l1.586 1.586a1 1 0 0 1 0 1.414z"/>
      <path d="m18 13-1.375-6.874a1 1 0 0 0-.746-.776L3.235 2.028a1 1 0 0 0-1.207 1.207L5.35 15.879a1 1 0 0 0 .776.746L13 18"/>
      <path d="m2.3 2.3 7.286 7.286"/><circle cx="11" cy="11" r="2"/>
      </svg>
    `),
  // editorial
  editorial: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/>
      <path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M10 9H8"/><path d="M16 13H8"/>
      <path d="M16 17H8"/>
      </svg>
    `),
  // devcom
  devcom: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>
      </svg>
    `),
  // literary
  literary: this.sanitizer.bypassSecurityTrustHtml(`
    <svg class="w-6 h-6 text-[#f4b400]" fill="none"
      stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
      viewBox="0 0 24 24">
      <path d="M12 7v14"/>
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
      </svg>
    `),

};

}
