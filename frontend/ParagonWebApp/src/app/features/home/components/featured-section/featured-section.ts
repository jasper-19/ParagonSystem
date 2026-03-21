import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { RouterModule } from '@angular/router';

import { ArticleService } from '../../../../core/services/article.service';
import { Article } from '../../../../models/article.model';

@Component({
  selector: 'app-featured-section',
  standalone: true,
  templateUrl: './featured-section.html',
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeaturedSection implements OnInit, OnDestroy {
  Math = Math;

  featured: Article[] = [];
  currentIndex = 0;
  offsets: number[] = [];
  slideStyles: Array<Record<string, string>> = [];

  private autoplayTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private articleService: ArticleService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.articleService.getFeaturedArticles().subscribe({
      next: (articles) => {
        // Avoid NG0100 in dev-mode double-check by deferring state changes
        // to the next macrotask (microtasks may still run before Angular’s
        // dev-mode checkNoChanges pass in some cases).
        setTimeout(() => {
          // Keep only the newest 5 featured articles (by createdAt = "added" time).
          this.featured = articles
            .filter((a: Article) => a.status === 'Published')
            .sort((a, b) => {
              const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return bTime - aTime;
            })
            .slice(0, 5);

          this.currentIndex = 0;
          this.updateDerivedState();

          this.stopAutoplay();
          if (this.featured.length > 1) {
            this.startAutoplay();
          }

          this.cdr.markForCheck();
        }, 0);
      },
      error: (err) => {
        console.error('Failed to load featured articles', err);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoplay();
  }

  get current(): Article | null {
    return this.featured[this.currentIndex] ?? null;
  }

  private computeOffset(i: number, len: number): number {
    if (!len) return 0;

    let diff = i - this.currentIndex;

    if (diff > len / 2) diff -= len;
    if (diff < -len / 2) diff += len;

    return diff;
  }

  private computeSlideStyles(offset: number): Record<string, string> {
    if (offset === 0) {
      return {
        left: '50%',
        'transform-origin': 'center',
        transform: 'perspective(1200px) translateX(-50%) rotateY(0deg)',
        'z-index': '30',
        opacity: '1',
        'pointer-events': 'auto',
        'box-shadow': '0 8px 20px rgba(0,0,53,0.12), 0 24px 60px rgba(0,0,53,0.18)',
      };
    }

    if (offset === 1) {
      return {
        left: '50%',
        'transform-origin': 'center',
        transform: 'perspective(1200px) translateX(-50%) translateX(90%) rotateY(20deg) scale(0.65)',
        'z-index': '20',
        opacity: '0.8',
        'pointer-events': 'auto',
      };
    }

    if (offset === -1) {
      return {
        left: '50%',
        'transform-origin': 'center',
        transform:
          'perspective(1200px) translateX(-50%) translateX(-90%) rotateY(-20deg) scale(0.65)',
        'z-index': '20',
        opacity: '0.8',
        'pointer-events': 'auto',
      };
    }

    const dir = offset > 0 ? 1 : -1;
    return {
      left: '50%',
      'transform-origin': 'center',
      transform: `perspective(1200px) translateX(${dir > 0 ? '130%' : '-230%'}) rotateY(${dir > 0 ? 60 : -60}deg) scale(0.65)`,
      'z-index': '0',
      opacity: '0',
      'pointer-events': 'none',
    };
  }

  private updateDerivedState(): void {
    const len = this.featured.length;
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

  trackById(index: number, item: Article) {
    return item.id;
  }

  prev(): void {
    if (!this.featured.length) return;

    this.currentIndex--;
    if (this.currentIndex < 0) {
      this.currentIndex = this.featured.length - 1;
    }

    this.updateDerivedState();
    this.resetAutoplay();
  }

  next(): void {
    if (!this.featured.length) return;

    this.currentIndex++;
    if (this.currentIndex >= this.featured.length) {
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
      const len = this.featured.length;
      if (!len) return;

      this.currentIndex = (this.currentIndex + 1) % len;
      this.updateDerivedState();
      this.cdr.markForCheck();
    }, 6000);
  }

  private stopAutoplay(): void {
    if (this.autoplayTimer) clearInterval(this.autoplayTimer);
    this.autoplayTimer = null;
  }

  private resetAutoplay(): void {
    this.stopAutoplay();
    if (this.featured.length > 1) {
      this.startAutoplay();
    }
  }
}
