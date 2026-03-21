import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';

import { ArticleService } from '../../../../core/services/article.service';
import { Article } from './../../../../models/article.model';
@Component({
  selector: 'app-category-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './category-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySection implements OnInit {
  sports: Article[] = [];
  news: Article[] = [];
  feature: Article[] = [];
  column: Article[] = [];
  literary: Article[] = [];
  editorial: Article[] = [];
  devcom: Article[] = [];

  constructor(
    private articleService: ArticleService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.articleService.getArticles({ page: 1, limit: 100, featured: false, sort: 'latest' }).subscribe({
      next: (all) => {
        // Defer state updates to avoid NG0100 in dev-mode double-check.
        setTimeout(() => {
          this.sports = all.filter((a) => a.category === 'Sports');
          this.news = all.filter((a) => a.category === 'News');
          this.feature = all.filter((a) => a.category === 'Feature');
          this.column = all.filter((a) => a.category === 'Column');
          this.literary = all.filter((a) => a.category === 'Literary');
          this.editorial = all.filter((a) => a.category === 'Editorial');
          this.devcom = all.filter((a) => a.category === 'DevCom');
          this.cdr.markForCheck();
        }, 0);
      },
      error: (err) => console.error('Failed to load category articles', err),
    });
  }
}
