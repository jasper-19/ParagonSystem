import { ErrorPage } from '../../shared/components/error-page/error-page';
import { Component, inject, DestroyRef, DOCUMENT, PLATFORM_ID, effect } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, map, tap } from 'rxjs/operators';
import { shareReplay } from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SeoService } from '../../core/services/seo.service';
import { ArticleService } from '../../core/services/article.service';
import { ArticleViewService } from './services/article-view.service';
import { Article as ArticleModel } from '../../models/article.model';
import { ArticleSectionComponent } from './components/section/section';
import { ArticleMeta } from './components/meta/meta';
import { Related } from './components/related/related';
import { OtherStories } from './components/other-stories/other-stories';
import { StaffApplication } from './components/staff-application/staff-application';
import { PageLoaderComponent } from '../../shared/components/page-loader/page-loader';
import { imageVariant } from '../../shared/utils/image-variant.util';

@Component({
  selector: 'app-article',
  standalone: true,
  imports: [
    CommonModule,
    ErrorPage,
    ArticleSectionComponent,
    ArticleMeta,
    Related,
    OtherStories,
    StaffApplication,
    PageLoaderComponent,
  ],
  templateUrl: './article.html',
  styleUrl: './article.scss',
})
export class ArticlePage {

  protected readonly imageVariant = imageVariant;

  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);
  private viewService = inject(ArticleViewService);
  private router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly document = inject(DOCUMENT);
  readonly articleFeed = this.articleService.articleFeed;
  readonly articleErrorStatus = this.articleService.articleFeedErrorStatus;
  readonly articleError = this.articleService.articleFeedError;

  private readonly articleFeed$ = toObservable(this.articleFeed);
  private readonly slugChanged$ =
    toObservable(
      this.articleService.slugChanged
    );

  article$ = this.articleFeed$.pipe(
    map(feed => feed?.article ?? null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  articleView$ = this.article$.pipe(
    map(article => article ? this.viewService.transform(article) : null),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readingTime$ = this.article$.pipe(
    map(article => {
      const words = this.stripHtml(article?.content ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .length;

      return `${Math.max(1, Math.ceil(words / 220))} min read`;
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    effect(() => {
      const error = this.articleError();
      const status = this.articleErrorStatus();
      if (error) {
        const slug = this.route.snapshot.paramMap.get('slug');
        this.seo.setUnavailable('/article/' + slug, status ?? 503);
      }
    });
  }

  ngOnInit(): void {
    this.route.paramMap
      .pipe(
        map(params =>
          params.get('slug')
        ),
        filter(
          (slug): slug is string =>
            !!slug
        ),
        tap(slug => {
          if (this.isBrowser) this.document.defaultView?.scrollTo({
            top: 0,
            left: 0,
            behavior: 'auto',
          });

          this.articleService
            .loadArticleFeed(slug);

          if (this.isBrowser) {
            this.articleService.incrementViews(slug).subscribe({ error: () => {} });
          }
        }),
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe();

    this.article$
      .pipe(
        filter((article): article is ArticleModel => !!article),
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(article => {
        this.seo.setArticle(article);
      });

    this.slugChanged$
      .pipe(
        filter(
          (
            change
          ): change is {
            previousSlug: string;
            currentSlug: string;
          } => !!change
        ),
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(change => {
        const routeSlug =
          this.route.snapshot.paramMap
            .get('slug');

        if (
          routeSlug !==
          change.previousSlug
        ) {
          return;
        }

        this.router
          .navigate(
            [
              '/article',
              change.currentSlug,
            ],
            {
              replaceUrl: true,
            }
          )
          .then(navigated => {
            if (navigated) {
              this.articleService
                .clearSlugChanged();
            }
          });
      });
  }

  retryArticle(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) this.articleService.loadArticleFeed(slug);
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

}
