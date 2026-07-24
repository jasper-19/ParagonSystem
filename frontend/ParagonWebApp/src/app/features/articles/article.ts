import { Component, inject, DestroyRef, DOCUMENT } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { filter, map, tap } from 'rxjs/operators';
import { Observable, distinctUntilChanged } from 'rxjs';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Meta, Title } from '@angular/platform-browser';
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
import { ImagePlaceholderComponent } from '../../shared/components/image-placeholder/image-placeholder';
import { Router } from '@angular/router';

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
    ImagePlaceholderComponent,
  ],
  templateUrl: './article.html',
})
export class ArticlePage {

  protected readonly imageVariant = imageVariant;

  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private readonly destroyRef = inject(DestroyRef);
  private viewService = inject(ArticleViewService);
  private router = inject(Router);
  private readonly meta = inject(Meta);
  private readonly pageTitle = inject(Title);
  private readonly document = inject(DOCUMENT);
  readonly articleFeed = this.articleService.articleFeed;

  private readonly articleFeed$ = toObservable(this.articleFeed);
  private readonly slugChanged$ =
    toObservable(
      this.articleService.slugChanged
    );

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
        map(params =>
          params.get('slug')
        ),
        filter(
          (slug): slug is string =>
            !!slug
        ),
        tap(slug => {
          console.log(
            'Loading article:',
            slug
          );

          this.articleService
            .loadArticleFeed(slug);

          this.articleService
            .incrementViews(slug)
            .subscribe({
              error: () => {},
            });
        }),
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe();

    this.article$
      .pipe(
        distinctUntilChanged(
          (previous, current) =>
            previous.id === current.id &&
            previous.title === current.title &&
            previous.excerpt === current.excerpt &&
            previous.image === current.image &&
            previous.slug === current.slug
        ),
        takeUntilDestroyed(
          this.destroyRef
        )
      )
      .subscribe(article => {
        this.updateArticleMetadata(
          article
        );
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

  private updateArticleMetadata(
    article: ArticleModel
  ): void {
    const siteName = 'Paragon Campus Press';

    const title =
      `${article.title} | ${siteName}`;

    const description =
      this.normalizeDescription(
        article.excerpt ||
        this.stripHtml(article.content)
      );

    const articleUrl = new URL(
      `/article/${article.slug}`,
      this.document.baseURI
    ).toString();

    const imageUrl =
      this.toAbsoluteUrl(article.image);

    this.pageTitle.setTitle(title);

    this.meta.updateTag({
      name: 'description',
      content: description,
    });

    this.meta.updateTag({
      property: 'og:type',
      content: 'article',
    });

    this.meta.updateTag({
      property: 'og:site_name',
      content: siteName,
    });

    this.meta.updateTag({
      property: 'og:title',
      content: article.title,
    });

    this.meta.updateTag({
      property: 'og:description',
      content: description,
    });

    this.meta.updateTag({
      property: 'og:url',
      content: articleUrl,
    });

    this.meta.updateTag({
      property: 'og:image',
      content: imageUrl,
    });

    this.meta.updateTag({
      property: 'og:image:alt',
      content: article.title,
    });

    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });

    this.meta.updateTag({
      name: 'twitter:title',
      content: article.title,
    });

    this.meta.updateTag({
      name: 'twitter:description',
      content: description,
    });

    this.meta.updateTag({
      name: 'twitter:image',
      content: imageUrl,
    });

    this.updateCanonicalLink(articleUrl);
  }

  private stripHtml(html: string): string {
    const element =
      this.document.createElement('div');

    element.innerHTML = html;

    return element.textContent ?? '';
  }

  // Helper methods for metadata processing
  private normalizeDescription(
    value: string
  ): string {
    const normalized = value
      .replace(/\s+/g, ' ')
      .trim();

    const maxLength = 200;

    if (normalized.length <= maxLength) {
      return normalized;
    }

    const shortened =
      normalized.slice(0, maxLength);

    const lastSpace =
      shortened.lastIndexOf(' ');

    return `${
      lastSpace > 0
        ? shortened.slice(0, lastSpace)
        : shortened
    }…`;
  }

  private toAbsoluteUrl(
    value: string | null | undefined
  ): string {
    const image = String(value ?? '').trim();

    if (!image) {
      return new URL(
        '/assets/images/paragon-social-preview.jpg',
        this.document.baseURI
      ).toString();
    }

    try {
      return new URL(
        image,
        this.document.baseURI
      ).toString();
    } catch {
      return image;
    }
  }

  private updateCanonicalLink(
    url: string
  ): void {
    let link =
      this.document.querySelector<HTMLLinkElement>(
        'link[rel="canonical"]'
      );

    if (!link) {
      link =
        this.document.createElement('link');

      link.setAttribute(
        'rel',
        'canonical'
      );

      this.document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }

}
