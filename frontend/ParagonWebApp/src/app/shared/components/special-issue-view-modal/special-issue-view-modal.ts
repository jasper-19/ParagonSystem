import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, Output, SimpleChanges, ViewChild } from '@angular/core';
import { SpecialIssue } from '../../../models/special-issue.model';

@Component({
  selector: 'app-special-issue-view-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './special-issue-view-modal.html',
  styleUrl: '../../styles/admin-special-issues.scss',
})
export class SpecialIssueViewModal implements OnChanges, OnDestroy, AfterViewChecked {
  @ViewChild('dialog') dialog?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  private returnFocus?: HTMLElement;
  private focusPending = false;
  @Input() issue: SpecialIssue | null = null;
  @Output() close = new EventEmitter<void>();

  showFullDescription = false;

  private previousBodyOverflow: string | null = null;
  private isScrollLocked = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (!('issue' in changes)) return;

    const isOpen = !!this.issue;
    if (isOpen) {
      if (!this.isScrollLocked) {
        this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
        this.focusPending = true;
      }
      this.lockBodyScroll();
      this.showFullDescription = false;
    } else {
      this.unlockBodyScroll();
    }
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();
  }

  ngAfterViewChecked(): void {
    if (this.focusPending && this.closeButton) {
      this.closeButton.nativeElement.focus();
      this.focusPending = false;
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeyDown(event: KeyboardEvent): void {
    if (!this.issue || !this.dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close.emit();
    } else if (event.key === 'Tab') {
      const elements = Array.from(this.dialog.nativeElement.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]'));
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
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
    this.focusPending = false;
    if (this.returnFocus?.isConnected) this.returnFocus.focus();
    this.returnFocus = undefined;
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

