import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DashboardCard } from '../dashboard-card/dashboard-card';

@Component({
  selector: 'app-articles-summary',
  imports: [CommonModule,
    DashboardCard
  ],
  templateUrl: './articles-summary.html',
})
export class ArticlesSummary {

  @Input({ required: true }) totalArticles!: number;
  @Input({ required: true }) publishedArticles!: number;
  @Input({ required: true }) draftArticles!: number;
  @Input({ required: true }) archivedArticles!: number;
}
