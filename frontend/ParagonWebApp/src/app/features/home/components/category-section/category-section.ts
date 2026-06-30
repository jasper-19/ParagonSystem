import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';

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
    forkJoin({
      sports: this.getCategory('Sports'),
      news: this.getCategory('News'),
      feature: this.getCategory('Feature'),
      column: this.getCategory('Column'),
      literary: this.getCategory('Literary'),
      editorial: this.getCategory('Editorial'),
      devcom: this.getCategory('DevCom'),
    }).subscribe({
      next: (data) => {
        this.sports = data.sports;
        this.news = data.news;
        this.feature = data.feature;
        this.column = data.column;
        this.literary = data.literary;
        this.editorial = data.editorial;
        this.devcom = data.devcom;

        this.cdr.markForCheck();
      },
      error: (err) => console.error('Failed to load category articles', err),
    });
  }

  private getCategory(category: Article['category']) {
    return this.articleService.getCategoryArticles(category, 4);
  }
}
