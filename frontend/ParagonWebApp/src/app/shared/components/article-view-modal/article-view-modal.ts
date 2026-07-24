import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  HostListener,
  ElementRef,
  ViewChild

} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  AdminArticleDetail,
  AdminArticleCredit,
  AdminArticleCreditType,
} from '../../../core/services/article.service';

@Component({
  selector: 'app-article-view-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './article-view-modal.html',
})
export class ArticleViewModal
  implements OnChanges, OnDestroy {

  @ViewChild('modalPanel')
  private modalPanel?: ElementRef<HTMLElement>;

  @ViewChild('closeButton')
  private closeButton?:
    ElementRef<HTMLButtonElement>;

  private previouslyFocusedElement:
    HTMLElement | null = null;

  @Input() article:
    AdminArticleDetail | null = null;

  @Input() loading = false;

  @Input() errorMessage:
    string | null = null;

  @Output() close =
    new EventEmitter<void>();


  private previousBodyOverflow:
    string | null = null;

  private isScrollLocked = false;

  ngOnChanges(
    changes: SimpleChanges
  ): void {
    const isOpen =
      !!this.article ||
      this.loading ||
      !!this.errorMessage;

    if (isOpen && !this.isScrollLocked) {
      if (typeof document !== 'undefined') {
        this.previouslyFocusedElement =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }

      this.lockBodyScroll();

      setTimeout(() => {
        const focusTarget =
          this.closeButton?.nativeElement ??
          this.modalPanel?.nativeElement;

        focusTarget?.focus();
      });
    } else if (!isOpen) {
      this.unlockBodyScroll();
      this.restorePreviousFocus();
    }
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
    this.restorePreviousFocus();
  }

  creditsByType(
    credits: AdminArticleCredit[],
    type: AdminArticleCreditType
  ): AdminArticleCredit[] {
    return credits.filter(
      credit =>
        credit.creditType === type
    );
  }

  creditNames(
    credits: AdminArticleCredit[],
    type: AdminArticleCreditType
  ): string {
    return this
      .creditsByType(credits, type)
      .map(
        credit =>
          credit.creditedName
      )
      .join(', ');
  }

  formatOverview(value: string): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  formatTag(tag: string): string {
    return String(tag ?? '')
      .trim()
      .replace(/^#+/, '')
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, character =>
        character.toUpperCase()
      );
  }

  hasCredits(
    article: AdminArticleDetail
  ): boolean {
    return article.credits.length > 0;
  }

  hasCreditType(
    credits: AdminArticleCredit[],
    type: AdminArticleCreditType
  ): boolean {
    return credits.some(
      credit => credit.creditType === type
    );
  }

  private restorePreviousFocus(): void {
    this.previouslyFocusedElement?.focus();
    this.previouslyFocusedElement = null;
  }

  private lockBodyScroll(): void {
    if (this.isScrollLocked) return;
    if (
      typeof document === 'undefined'
    ) {
      return;
    }

    this.previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    this.isScrollLocked = true;
  }

  private unlockBodyScroll(): void {
    if (!this.isScrollLocked) return;
    if (
      typeof document === 'undefined'
    ) {
      return;
    }

    document.body.style.overflow =
      this.previousBodyOverflow ?? '';

    this.previousBodyOverflow = null;
    this.isScrollLocked = false;
  }

@HostListener('document:keydown', ['$event'])
onDocumentKeydown(
  event: KeyboardEvent
): void {
  const isOpen =
    !!this.article ||
    this.loading ||
    !!this.errorMessage;

  if (!isOpen) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    this.close.emit();
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const focusable =
    this.getFocusableElements();

  if (focusable.length === 0) {
    event.preventDefault();
    this.modalPanel?.nativeElement.focus();
    return;
  }

  const firstElement = focusable[0];
  const lastElement =
    focusable[focusable.length - 1];

  const activeElement =
    document.activeElement;

  if (
    event.shiftKey &&
    (
      activeElement === firstElement ||
      activeElement ===
        this.modalPanel?.nativeElement
    )
  ) {
    event.preventDefault();
    lastElement.focus();
    return;
  }

  if (
    !event.shiftKey &&
    activeElement === lastElement
  ) {
    event.preventDefault();
    firstElement.focus();
  }
}

  private readonly focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  private getFocusableElements(): HTMLElement[] {
    const panel = this.modalPanel?.nativeElement;

    if (!panel) {
      return [];
    }

    return Array.from(
      panel.querySelectorAll<HTMLElement>(
        this.focusableSelector
      )
    ).filter(element =>
      element.offsetParent !== null
    );
  }
}
