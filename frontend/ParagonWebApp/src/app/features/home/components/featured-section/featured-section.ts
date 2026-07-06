import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';

@Component({
  selector: 'app-featured-section',
  standalone: true,
  templateUrl: './featured-section.html',
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedSection implements OnDestroy {
  protected readonly imageVariant = imageVariant;

  protected readonly Math = Math;

private readonly CAROUSEL = {
  heroWidth: 'min(68vw, 980px)',
  sideScale: 0.82,
  sideOffset: 52,
  sideBlur: 5,
  hiddenScale: 0.72,
  animationDuration: 520,
  autoplayInterval: 6000,
  shadow: '0 18px 45px rgba(0,0,53,0.22), 0 35px 90px rgba(0,0,53,0.18)',
} as const;

private _articles: Article[] = [];

@Input({ required: true })
set articles(value: Article[]) {
    if (value === this._articles) {
        return;
    }
    this._articles = value ?? [];
    this.initializeCarousel();
    this.cdr.markForCheck();
}

    get articles(): Article[] {
      return this._articles;
    }

  currentIndex = 0;
  offsets: number[] = [];
  slideStyles: Array<Record<string, string>> = [];

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
  ) {}


  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  get current(): Article | null {
      return this.articles[this.currentIndex] ?? null;
  }

  private computeOffset(i: number, len: number): number {
    if (!len) return 0;

    let diff = i - this.currentIndex;

    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;

    return diff;
  }

private computeSlideStyles(offset: number): Record<string, string> {

  const {
    heroWidth,
    sideScale,
    sideOffset,
    sideBlur,
    hiddenScale,
    animationDuration,
  } = this.CAROUSEL;

  const base = {
    top: '0',
    left: '50%',
    width: heroWidth,
    height: '100%',
    'transform-origin': 'center',
    transition: `
      transform ${animationDuration}ms ease,
      opacity ${animationDuration}ms ease,
      filter ${animationDuration}ms ease
    `,
  };

  if (offset === 0) {
    return {
      ...base,
      transform: 'translateX(-50%) scale(1)',
      'z-index': '30',
      opacity: '1',
      filter: 'blur(0)',
      'pointer-events': 'auto',
      'box-shadow':
        this.CAROUSEL.shadow,
    };
  }

  if (offset === -1) {
    return {
      ...base,
      transform: `translateX(-${sideOffset + 50}%) scale(${sideScale})`,
      'z-index': '10',
      opacity: '0.55',
      filter: `blur(${sideBlur}px)`,
      'pointer-events': 'auto',
    };
  }

  if (offset === 1) {
    return {
      ...base,
      transform: `translateX(${sideOffset - 50}%) scale(${sideScale})`,
      'z-index': '10',
      opacity: '0.55',
      filter: `blur(${sideBlur}px)`,
      'pointer-events': 'auto',
    };
  }

  return {
    ...base,
    transform: `translateX(${offset > 0 ? '80%' : '-180%'}) scale(${hiddenScale})`,
    'z-index': '0',
    opacity: '0',
    filter: `blur(${sideBlur + 3}px)`,
    'pointer-events': 'none',
  };
}

  private updateDerivedState(): void {
    const len = this.articles.length;
    if (!len) {
      this.offsets = [];
      this.slideStyles = [];
      return;
    }

    const offsets = new Array<number>(len);
    const slideStyles = new Array<Record<string, string>>(len);

    for (let i = 0; i < len; i++) {
      const offset = this.computeOffset(i, len);
      offsets[i] = offset;
      slideStyles[i] = this.computeSlideStyles(offset);
    }

    this.offsets = offsets;
    this.slideStyles = slideStyles;
  }

  private initializeCarousel(): void {
      this.currentIndex = Math.min(
          this.currentIndex,
          Math.max(this.articles.length - 1, 0)
      );
      this.updateDerivedState();
      this.stopAutoplay();
      if (this.articles.length > 1) {
          this.startAutoplay();
      }
  }

  trackById(index: number, item: Article): string {
    return item.id;
  }

  prev(): void {
    if (!this.articles.length) return;

    this.currentIndex--;
    if (this.currentIndex < 0) {
      this.currentIndex = this.articles.length - 1;
    }

    this.updateDerivedState();
    this.resetAutoplay();
  }

  next(): void {
    if (!this.articles.length) return;

    this.currentIndex++;
    if (this.currentIndex >= this.articles.length) {
      this.currentIndex = 0;
    }

    this.updateDerivedState();
    this.resetAutoplay();
  }

  goTo(index: number): void {
    this.currentIndex = index;
    this.updateDerivedState();
    this.resetAutoplay();
  }

  private startAutoplay(): void {
    this.autoplayTimer = setInterval(() => {
      const len = this.articles.length;
      if (!len) return;

      this.currentIndex = (this.currentIndex + 1) % len;
      this.updateDerivedState();
      this.cdr.markForCheck();
    }, this.CAROUSEL.autoplayInterval);
  }

  private stopAutoplay(): void {
    if (this.autoplayTimer) clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
  }

  private resetAutoplay(): void {
    this.stopAutoplay();
    if (this.articles.length > 1) {
      this.startAutoplay();
    }
  }
}
