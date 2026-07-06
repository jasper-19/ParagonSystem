import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { take, finalize } from 'rxjs/operators';
import { ArticleService } from '../../core/services/article.service';
import { LoaderService } from '../../shared/services/loader.service';
import { FeaturedSection } from './components/featured-section/featured-section';
import { MostViewedSection } from './components/most-viewed-section/most-viewed-section';
import { CategorySection } from './components/category-section/category-section';
import { MoreStoriesSection } from './components/more-stories-section/more-stories-section';
import { WelcomeBanner } from './components/welcome-banner/welcomebanner';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
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

  private readonly loader = inject(LoaderService);
  private readonly articleService = inject(ArticleService);

  readonly homepageFeed = this.articleService.homepageFeed;

  ngOnInit(): void {

    this.loader.show();

    this.articleService
      .getHomepageFeed()
      .pipe(
        take(1),
        finalize(() => this.loader.hide())
      )
      .subscribe({
        error: err => {
          console.error('Failed to load homepage feed', err);
        }
      });
  }
}
