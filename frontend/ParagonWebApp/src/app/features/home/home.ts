import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
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

  constructor(private loader: LoaderService) {
  }

  ngOnInit() {
    this.loader.show();

    setTimeout(() => {
      this.loader.hide();
    }, 3000);
  }
}
