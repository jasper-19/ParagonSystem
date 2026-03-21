import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { switchMap, map, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

import { ArticleService } from '../../core/services/article.service';
import { ArticleViewService } from './services/article-view.service';
import { LoaderService } from '../../shared/services/loader.service';
import { Article as ArticleModel } from '../../models/article.model';
import { ArticleView } from './models/article-view.model';
import { ArticleSectionComponent } from './components/section/section';
import { WelcomeBanner } from '../home/components/welcome-banner/welcomebanner';
import { ArticleMeta } from './components/meta/meta';
import { Related } from './components/related/related';
import { OtherStories } from './components/other-stories/other-stories';
import { StaffApplication } from './components/staff-application/staff-application';
import { ArticleSkeleton } from './components/skeleton/article-skeleton';

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

  private route = inject(ActivatedRoute);
  private articleService = inject(ArticleService);
  private viewService = inject(ArticleViewService);

  article$!: Observable<ArticleModel>;
  articleView$!: Observable<ArticleView>;
  related$!: Observable<ArticleModel[]>;
  otherStories$!: Observable<ArticleModel[]>;

ngOnInit() {

  this.article$ = this.route.paramMap.pipe(
    map(params => params.get('slug')!),
    switchMap(slug =>
      this.articleService.getBySlug(slug).pipe(
        tap(() => {
          this.articleService.incrementViews(slug).subscribe({ error: () => {} });
        })
      )
    )
  );

  this.articleView$ = this.article$.pipe(
    map(article => this.viewService.transform(article))
  );

  this.related$ = this.article$.pipe(
    switchMap(article =>
      this.articleService.getRelatedArticles(article.slug, article.category)
    )
  );

  this.otherStories$ = this.article$.pipe(
    switchMap(article =>
      this.articleService.getOtherStories(article.slug)
    )
  );
}
}
