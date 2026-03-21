import { Article } from '../../../../models/article.model';
import { CommonModule } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ArticleService } from "../../../../core/services/article.service";
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-most-viewed-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './most-viewed-section.html'
})
export class MostViewedSection {
  articles: Article[] = [];

  constructor(private articleService: ArticleService) {}

  ngOnInit(): void {
    this.articleService.getArticles({ page: 1, limit: 50, featured: false, sort: 'mostViewed' }).subscribe({
      next: (articles) => (this.articles = articles.slice(0, 6)),
      error: (err) => console.error('Failed to load most viewed articles', err),
    });
  }
}
