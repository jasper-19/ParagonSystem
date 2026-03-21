import { CommonModule } from '@angular/common';
import { ArticleService } from '../../../../core/services/article.service';
import { Article } from '../../../../models/article.model';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';


@Component({
  selector: 'app-more-stories-section',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './more-stories-section.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})

export class MoreStoriesSection implements OnInit {

  stories: Article[] = [];

  constructor(
    private articleService: ArticleService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.articleService.getArticles({ page: 1, limit: 50, featured: false, sort: 'latest' }).subscribe({
      next: (articles) => {
        // Defer state updates to avoid NG0100 in dev-mode double-check.
        setTimeout(() => {
          this.stories = articles;
          this.cdr.markForCheck();
        }, 0);
      },
      error: (err) => console.error('Failed to load more stories', err),
    });
  }
}
