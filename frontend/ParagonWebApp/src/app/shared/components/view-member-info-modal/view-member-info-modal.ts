import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, OnDestroy, effect, inject, input, output, AfterViewInit, ElementRef, HostListener, ViewChild,  } from '@angular/core';

import { BoardMember } from '../../../models/editorial-board.model';

let viewMemberScrollLockCount = 0;

@Component({
  selector: 'app-view-member-info-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-member-info-modal.html',
})
export class ViewMemberInfoModalComponent implements OnDestroy, AfterViewInit {

  @ViewChild('dialogContainer')
  private dialogContainer?: ElementRef<HTMLElement>;

  @ViewChild('closeButton')
  private closeButton?: ElementRef<HTMLButtonElement>;

  private previouslyFocusedElement:
    HTMLElement | null = null;

  private viewInitialized = false;

  private readonly document = inject(DOCUMENT);
  private locked = false;
  private previousOverflow: string | null = null;

  // Inputs
  member       = input<BoardMember | null>(null);
  sectionTitle = input<string | null>(null);
  isOpen       = input<boolean>(false);

  // Outputs
  closed        = output<void>();
  editRequested = output<void>();

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        this.previouslyFocusedElement =
          this.document.activeElement instanceof HTMLElement
            ? this.document.activeElement
            : null;

        this.lockScroll();

        if (this.viewInitialized) {
          this.focusInitialElement();
        }

        return;
      }

      this.unlockScroll();
      this.restorePreviousFocus();
    });
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;

    if (this.isOpen()) {
      this.focusInitialElement();
    }
  }

  ngOnDestroy(): void {
    this.unlockScroll();
    this.restorePreviousFocus();
  }

  close(): void {
    this.closed.emit();
  }

  requestEdit(): void {
    this.editRequested.emit();
  }

  readonly YEAR_LEVEL_LABELS: Record<string, string> = {
    '1st_year':    '1st Year',
    '2nd_year':    '2nd Year',
    '3rd_year':    '3rd Year',
    '4th_year':    '4th Year',
    'unspecified': '—',
  };

  private focusInitialElement(): void {
    queueMicrotask(() => {
      const closeButton =
        this.closeButton?.nativeElement;

      const dialog =
        this.dialogContainer?.nativeElement;

      if (closeButton) {
        closeButton.focus();
        return;
      }

      dialog?.focus();
    });
  }

  private restorePreviousFocus(): void {
    const target =
      this.previouslyFocusedElement;

    this.previouslyFocusedElement = null;

    if (
      !target ||
      !this.document.contains(target)
    ) {
      return;
    }

    queueMicrotask(() => {
      target.focus({
        preventScroll: true,
      });
    });
  }

  getYearLevelLabel(value: string | undefined): string {
    if (!value) return '—';
    return this.YEAR_LEVEL_LABELS[value] ?? value;
  }

  private lockScroll(): void {
    if (this.locked) return;
    const body = this.document?.body;
    if (!body) return;
    viewMemberScrollLockCount += 1;
    if (viewMemberScrollLockCount === 1) {
      this.previousOverflow = body.style.overflow;
      body.style.overflow = 'hidden';
    }
    this.locked = true;
  }

  private unlockScroll(): void {
    if (!this.locked) return;
    const body = this.document?.body;
    if (!body) return;
    viewMemberScrollLockCount = Math.max(0, viewMemberScrollLockCount - 1);
    if (viewMemberScrollLockCount === 0) {
      body.style.overflow = this.previousOverflow ?? '';
      this.previousOverflow = null;
    }
    this.locked = false;
  }

  onDialogKeydown(
    event: KeyboardEvent
  ): void {
    if (event.key !== 'Tab') {
      return;
    }

    const dialog =
      this.dialogContainer?.nativeElement;

    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'a[href]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',')
      )
    ).filter(element =>
      element.offsetParent !== null &&
      element.getAttribute('aria-hidden') !== 'true'
    );

    if (!focusableElements.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first =
      focusableElements[0];

    const last =
      focusableElements[
        focusableElements.length - 1
      ];

    const active =
      this.document.activeElement;

    if (
      event.shiftKey &&
      (
        active === first ||
        active === dialog
      )
    ) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (
      !event.shiftKey &&
      active === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscapeKey(event: Event): void {
    if (!this.isOpen()) {
      return;
    }

    event.preventDefault();

    this.close();
  }

}
