import { Component, EventEmitter, Output, inject } from '@angular/core';
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
export class SearchModal {
  @Output() close = new EventEmitter<void>();

  private articleService = inject(ArticleService);
  private router = inject(Router);

  query = '';
  results: Article[] = [];
  isLoading = false;
  hasSearched = false;

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

  onSearchChange(value: string): void {
    this.query = value;
    this.search$.next(value);
  }

  openArticle(article: Article): void {
    this.close.emit();
    this.router.navigate(['/article', article.slug]);
  }

  goToCategory(category: string): void {
    this.close.emit();
    this.router.navigate(['/top-stories'], {
      queryParams: { category }
    });
  }

  onBackdropClick(): void {
    this.close.emit();
  }
}
