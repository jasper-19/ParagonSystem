import { Component, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { filter, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArticleService } from '../../core/services/article.service';
import { ArticleViewService } from './services/article-view.service';
import { Article as ArticleModel } from '../../models/article.model';
import { ArticleView } from './models/article-view.model';
import { ArticleSectionComponent } from './components/section/section';
import { WelcomeBanner } from '../home/components/welcome-banner/welcomebanner';
import { ArticleMeta } from './components/meta/meta';
import { Related } from './components/related/related';
import { OtherStories } from './components/other-stories/other-stories';
import { StaffApplication } from './components/staff-application/staff-application';
import { ArticleSkeleton } from './components/skeleton/article-skeleton';
import { imageVariant } from '../../shared/utils/image-variant.util';
import { ArticleFeed } from '../../models/article-feed.model';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [
    CommonModule,
    ArticleSectionComponent,
    WelcomeBanner,
    ArticleMeta,
    Related,
    OtherStories,
    StaffApplication,
    ArticleSkeleton,
  ],
  templateUrl: './article.html',
})
export class ArticlePage {

  protected readonly imageVariant = imageVariant;

  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);
  private viewService = inject(ArticleViewService);

  readonly articleFeed = this.articleService.articleFeed;

  private readonly articleFeed$ = toObservable(this.articleFeed);

  article$ = this.articleFeed$.pipe(
    map(feed => feed?.article),
    filter((article): article is ArticleModel => !!article)
  );

  articleView$ = this.article$.pipe(
    map(article => this.viewService.transform(article))
  );

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map(params => params.get('slug')),
        filter((slug): slug is string => !!slug),
        tap(slug => {
          this.articleService.loadArticleFeed(slug);

          this.articleService.incrementViews(slug).subscribe({
            error: () => {},
          });
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
}
