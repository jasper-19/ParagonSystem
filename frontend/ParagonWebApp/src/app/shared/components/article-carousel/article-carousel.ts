import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  Input,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Article } from '../../../models/article.model';
import { imageVariant } from '../../utils/image-variant.util';
import { ImagePlaceholderComponent } from '../image-placeholder/image-placeholder';

@Component({
  selector: 'app-article-carousel',
  standalone: true,
  imports: [CommonModule, RouterModule, ImagePlaceholderComponent],
  templateUrl: './article-carousel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleCarouselComponent {
  protected readonly imageVariant = imageVariant;

  private readonly _articles = signal<Article[]>([]);

  private touchStartX = 0;
  private touchEndX = 0;
  private readonly swipeThreshold = 50; // Minimum distance for a swipe to be recognized

  @Input({ required: true })
  set articles(value: Article[]) {
    this._articles.set(value ?? []);

    this.currentPage.set(0);
    this.renderedPageIndex.set(1);
    this.isTransitioning.set(false);
  }

  @Input() title = 'Stories';
  @Input() eyebrow = '';
  @Input() sectionClass = 'w-full bg-[#f4b400]/10 py-12 sm:py-16';

  readonly currentPage = signal(0);
  readonly cardsPerView = signal(this.getCardsPerView());

  readonly renderedPageIndex = signal(1);
  readonly isTransitioning = signal(true);

  readonly articlesList = this._articles.asReadonly();

  readonly pages = computed(() => {
    const articles = this.articlesList();
    const size = this.cardsPerView();

    const pages: Article[][] = [];

    for (let i = 0; i < articles.length; i += size) {
      pages.push(articles.slice(i, i + size));
    }

    return pages;
  });

  readonly renderedPages = computed(() => {
    const pages = this.pages();

    if (pages.length <= 1) return pages;

    return [
      pages[pages.length - 1],
      ...pages,
      pages[0],
    ];
  });

  readonly showArrows = computed(() => {
    return (
      this.cardsPerView() > 1 &&
      this.articlesList().length > this.cardsPerView()
    );
  });

  readonly showDots = computed(() => {
    return (
      this.cardsPerView() === 1 &&
      this.articlesList().length > 1
    );
  });

  readonly dots = computed(() =>
    Array.from({ length: this.totalPages() }, (_, i) => i)
  );

  readonly trackStyle = computed(() => {
    const total = this.totalPages();
    const index = total <= 1 ? 0 : this.renderedPageIndex();

    return {
      transform: `translateX(-${index * 100}%)`,
      transition: this.isTransitioning()
        ? 'transform 500ms ease-out'
        : 'none',
    };
  });

  @HostListener('window:resize')
  onResize(): void {
    const nextCardsPerView = this.getCardsPerView();

    if (nextCardsPerView !== this.cardsPerView()) {
      this.cardsPerView.set(nextCardsPerView);
      this.currentPage.set(0);
      this.renderedPageIndex.set(1);
      this.isTransitioning.set(false);
    }
  }

  next(): void {
    if (this.totalPages() <= 1) return;

    this.isTransitioning.set(true);
    this.renderedPageIndex.update(index => index + 1);
  }

  prev(): void {
    if (this.totalPages() <= 1) return;

    this.isTransitioning.set(true);
    this.renderedPageIndex.update(index => index - 1);
  }

  goTo(page: number): void {
    if (page < 0 || page >= this.totalPages()) return;

    this.isTransitioning.set(true);
    this.currentPage.set(page);
    this.renderedPageIndex.set(page + 1);
  }

  trackByArticle(index: number, article: Article): string {
    return article.id;
  }

  private getCardsPerView(): number {
    if (typeof window === 'undefined') return 3;

    if (window.innerWidth < 768) return 1;
    if (window.innerWidth < 1280) return 2;

    return 3;
  }

  onTransitionEnd(): void {
    const total = this.totalPages();
    const index = this.renderedPageIndex();

    if (total <= 1) return;

    if (index === total + 1) {
      this.isTransitioning.set(false);
      this.renderedPageIndex.set(1);
      this.currentPage.set(0);
      return;
    }

    if (index === 0) {
      this.isTransitioning.set(false);
      this.renderedPageIndex.set(total);
      this.currentPage.set(total - 1);
      return;
    }

    this.currentPage.set(index - 1);
  }

  readonly totalPages = computed(() => this.pages().length);

  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.screenX ?? 0;
  }

  onTouchEnd(event: TouchEvent): void {
    this.touchEndX = event.changedTouches[0]?.screenX ?? 0;
    this.handleSwipe();
  }

  private handleSwipe(): void {
    const distance = this.touchStartX - this.touchEndX;

    if (Math.abs(distance) < this.swipeThreshold) {
      return;
    }

    if (distance > 0) {
      this.next();
    } else {
      this.prev();
    }
  }
}
