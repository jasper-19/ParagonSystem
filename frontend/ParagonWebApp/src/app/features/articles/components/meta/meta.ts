import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-article-meta',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './meta.html',
})
export class ArticleMeta {
  @Input() title!: string;
  @Input() excerpt?: string;

  @Input() author!: string;
  @Input() publishedAt?: Date;
  @Input() category!: string;
  @Input() views!: number;

  @Input() photoby?: string;
  @Input() graphicby?: string;
  @Input() illusrationby?: string;

  @Input() readingTime?: string; // optional (e.g. "1 min read")

  readonly linkCopied = signal(false);
  readonly canUseNativeShare =
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function';

  private readonly destroyRef = inject(DestroyRef);

  private copyFeedbackTimer?: ReturnType<
    typeof setTimeout
  >;

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.copyFeedbackTimer) {
        clearTimeout(this.copyFeedbackTimer);
      }
    });
  }

  async shareArticle(): Promise<void> {
    if (!this.canUseNativeShare) return;

    try {
      await navigator.share({
        title: this.title,
        text: this.excerpt,
        url: window.location.href,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      await this.copyArticleLink();
    }
  }

  async copyArticleLink(): Promise<void> {
    const url = window.location.href;

    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(url);
      } else {
        this.copyUsingFallback(url);
      }

      this.showCopiedFeedback();
    } catch (error) {
      console.error(
        'Failed to copy article link:',
        error
      );

      this.copyUsingFallback(url);
      this.showCopiedFeedback();
    }
  }

  private copyUsingFallback(url: string): void {
    const textArea =
      document.createElement('textarea');

    textArea.value = url;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';

    document.body.appendChild(textArea);

    textArea.select();
    document.execCommand('copy');

    document.body.removeChild(textArea);
  }

  private showCopiedFeedback(): void {
    this.linkCopied.set(true);

    if (this.copyFeedbackTimer) {
      clearTimeout(this.copyFeedbackTimer);
    }

    this.copyFeedbackTimer = setTimeout(() => {
      this.linkCopied.set(false);
    }, 2000);
  }
}
