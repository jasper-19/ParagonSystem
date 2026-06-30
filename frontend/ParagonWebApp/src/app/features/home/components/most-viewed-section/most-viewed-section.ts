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
    this.articleService.getMostViewedArticles().subscribe({
      next: (articles) => (this.articles = articles),
      error: (err) => console.error('Failed to load most viewed articles', err),
    });
  }
}
