import { PageLoaderComponent } from '../../shared/components/page-loader/page-loader';
import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { take, finalize } from 'rxjs/operators';
import { ArticleService } from '../../core/services/article.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FeaturedSection } from './components/featured-section/featured-section';
import { MostViewedSection } from './components/most-viewed-section/most-viewed-section';
import { CategorySection } from './components/category-section/category-section';
import { MoreStoriesSection } from './components/more-stories-section/more-stories-section';
import { WelcomeBanner } from './components/welcome-banner/welcomebanner';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    PageLoaderComponent,
    CommonModule,
    RouterModule,
    FeaturedSection,
    MostViewedSection,
    CategorySection,
    MoreStoriesSection,
    WelcomeBanner
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.scss']
})
export class Home implements OnInit {

  private readonly destroyRef = inject(DestroyRef);
  readonly loading = signal(true);
  private readonly articleService = inject(ArticleService);

  readonly homepageFeed = this.articleService.homepageFeed;

  ngOnInit(): void {

    this.loading.set(true);

    this.articleService
      .getHomepageFeed()
      .pipe(
        take(1),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        error: err => {
          console.error('Failed to load homepage feed', err);
        }
      });
  }
}
