import { Component, EventEmitter, Output, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap, catchError, tap } from 'rxjs/operators';

import { ArticleService } from '../../../core/services/article.service';
import { Article } from '../../../models/article.model';

@Component({
  selector: 'app-search-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-modal.html'
})
export class SearchModal implements OnInit {
  @Output() close = new EventEmitter<void>();

  private articleService = inject(ArticleService);
  private router = inject(Router);

  query = '';
  results: Article[] = [];
  isLoading = false;
  hasSearched = false;

  recentArticles: Article[] = []; // Store recent articles for display when no search query is entered

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
    this.loadRecentArticles();
  }

  loadRecentArticles(): void {
    this.articleService.getArticles({
      page: 1,
      limit: 5,
      sort: 'latest',
    }).subscribe({
      next: (articles) => {
        this.recentArticles = articles;
      },
      error: () => {
        this.recentArticles = [];
      }
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
}
