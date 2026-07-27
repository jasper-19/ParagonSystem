import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Article } from '../../../../models/article.model';
import { imageVariant } from '../../../../shared/utils/image-variant.util';
import { ImagePlaceholderComponent } from '../../../../shared/components/image-placeholder/image-placeholder';
import { ScrollRevealDirective } from '../../scroll-reveal.directive';

@Component({
  selector: 'app-featured-section',
  standalone: true,
  templateUrl: './featured-section.html',
  styleUrl: './featured-section.scss',
  imports: [CommonModule, RouterModule, ImagePlaceholderComponent, ScrollRevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedSection implements OnDestroy {
  protected readonly imageVariant = imageVariant;
  private readonly autoplayInterval = 7000;

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

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;
  private pointerStartX: number | null = null;
  private interactionPaused = false;

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

  private updateDerivedState(): void {
    const len = this.articles.length;
    if (!len) {
      this.offsets = [];
      return;
    }

    const offsets = new Array<number>(len);

    for (let i = 0; i < len; i++) {
      offsets[i] = this.computeOffset(i, len);
    }

    this.offsets = offsets;
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
    if (
      this.interactionPaused ||
      typeof window === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    this.autoplayTimer = setInterval(() => {
      const len = this.articles.length;
      if (!len) return;

      this.currentIndex = (this.currentIndex + 1) % len;
      this.updateDerivedState();
      this.cdr.markForCheck();
    }, this.autoplayInterval);
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

  pauseAutoplay(): void {
    this.interactionPaused = true;
    this.stopAutoplay();
  }

  resumeAutoplay(): void {
    this.interactionPaused = false;
    if (this.articles.length > 1) {
      this.startAutoplay();
    }
  }

  onPointerDown(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    this.pointerStartX = event.clientX;
    this.pauseAutoplay();
  }

  onPointerUp(event: PointerEvent): void {
    if (this.pointerStartX === null) return;

    const distance = event.clientX - this.pointerStartX;
    this.pointerStartX = null;

    if (Math.abs(distance) >= 48) {
      distance < 0 ? this.next() : this.prev();
    }

    this.resumeAutoplay();
  }

  cancelPointer(): void {
    this.pointerStartX = null;
    this.resumeAutoplay();
  }
}
