import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Article } from '../../../models/article.model';

@Component({
  selector: 'app-article-view-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './article-view-modal.html',
})
export class ArticleViewModal implements OnChanges, OnDestroy {
  @Input() article: Article | null = null;
  @Output() close = new EventEmitter<void>();

  showFullContent = false;

  private previousBodyOverflow: string | null = null;
  private isScrollLocked = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('article' in changes)) return;

    const isOpen = !!this.article;
    if (isOpen) {
      this.lockBodyScroll();
      this.showFullContent = false;
    } else {
      this.unlockBodyScroll();
    }
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  private lockBodyScroll(): void {
    if (this.isScrollLocked) return;
    if (typeof document === 'undefined') return;

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.isScrollLocked = true;
  }

  private unlockBodyScroll(): void {
    if (!this.isScrollLocked) return;
    if (typeof document === 'undefined') return;

    document.body.style.overflow = this.previousBodyOverflow ?? '';
    this.previousBodyOverflow = null;
    this.isScrollLocked = false;
  }

  toggleContent(): void {
    this.showFullContent = !this.showFullContent;
  }

  contentPreview(html: string | undefined | null, maxChars = 700): string {
    const raw = String(html ?? '');
    if (!raw.trim()) return '';

    // Simple HTML -> text collapse for preview (no DOM dependency).
    const text = raw
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars).trimEnd() + '...';
  }
}
