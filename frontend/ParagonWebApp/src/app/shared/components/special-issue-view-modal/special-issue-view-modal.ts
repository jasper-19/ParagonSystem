import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { SpecialIssue } from '../../../models/special-issue.model';

@Component({
  selector: 'app-special-issue-view-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './special-issue-view-modal.html',
})
export class SpecialIssueViewModal implements OnChanges, OnDestroy {
  @Input() issue: SpecialIssue | null = null;
  @Output() close = new EventEmitter<void>();

  showFullDescription = false;

  private previousBodyOverflow: string | null = null;
  private isScrollLocked = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('issue' in changes)) return;

    const isOpen = !!this.issue;
    if (isOpen) {
      this.lockBodyScroll();
      this.showFullDescription = false;
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

  toggleDescription(): void {
    this.showFullDescription = !this.showFullDescription;
  }

  descriptionPreview(text: string | undefined | null, maxChars = 600): string {
    const raw = String(text ?? '').trim();
    if (!raw) return '';
    if (raw.length <= maxChars) return raw;
    return raw.slice(0, maxChars).trimEnd() + '...';
  }

  pdfFilename(i: SpecialIssue): string {
    const base = i.slug?.trim() || 'special-issue';
    return `${base}.pdf`;
  }
}

