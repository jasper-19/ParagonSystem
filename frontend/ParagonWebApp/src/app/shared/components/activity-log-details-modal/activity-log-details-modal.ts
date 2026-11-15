import { activityActionLabel, activityDescription, activityModuleLabel } from '../../../models/activity-log-presentation';
import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivityLog } from '../../../models/activity-log.model';
import { activityDetailGroups, ActivityDetailGroup } from '../../../models/activity-log-metadata';
import { activityActorName, activityActorType } from '../../../models/activity-log-actor';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-activity-log-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-log-details-modal.html',
  styleUrl: './activity-log-details-modal.scss',
})
export class ActivityLogDetailsModalComponent implements AfterViewInit, OnDestroy {

  private currentLog!: ActivityLog;
  detailGroups: ActivityDetailGroup[] = [];

  @Input() set log(value: ActivityLog) {
    this.currentLog = value;
    this.detailGroups = activityDetailGroups(value);
  }
  get log(): ActivityLog { return this.currentLog; }
  @Output() close = new EventEmitter<void>();

  private readonly document =
    inject(DOCUMENT);

  @ViewChild('dialog')
  private dialog?: ElementRef<HTMLElement>;

  @ViewChild('closeButton')
  private closeButton?: ElementRef<HTMLButtonElement>;

  private previouslyFocusedElement:
    HTMLElement | null = null;

  private previousBodyOverflow = '';

  ngAfterViewInit(): void {
    this.previouslyFocusedElement =
      this.document.activeElement
        instanceof HTMLElement
        ? this.document.activeElement
        : null;

    this.previousBodyOverflow =
      this.document.body.style.overflow;

    this.document.body.style.overflow =
      'hidden';

    queueMicrotask(() => {
      this.closeButton
        ?.nativeElement
        .focus();
    });
  }

  ngOnDestroy(): void {
    this.document.body.style.overflow =
      this.previousBodyOverflow;

    this.previouslyFocusedElement
      ?.focus();
  }

  onClose(): void {
    this.close.emit();
  }

  onBackdropClick(
    event: MouseEvent
  ): void {
    if (
      event.target ===
      event.currentTarget
    ) {
      this.onClose();
    }
  }

  onDialogKeydown(
    event: Event
  ): void {

    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.key !== 'Tab') {
      return;
    }

    const dialog = this.dialog?.nativeElement;

    if (!dialog) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          '[href]',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',')
      )
    ).filter(element => !element.hasAttribute('aria-hidden'));

    if (!focusableElements.length) {
      keyboardEvent.preventDefault();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];

    if (
      keyboardEvent.shiftKey &&
      this.document.activeElement === first
    ) {
      keyboardEvent.preventDefault();
      last.focus();
      return;
    }

    if (
      !keyboardEvent.shiftKey &&
      this.document.activeElement === last
    ) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }

  //Helpers
  getActorName(): string {
    return activityActorName(this.log);
  }

  getActorType(): string {
    return activityActorType(this.log);
  }

  getInitial(): string {
    const actor =
      this.getActorName();

    return actor
      .charAt(0)
      .toUpperCase();
  }

 // ==========================
  // Display Formatters
  // ==========================

  formatAction(action?: string): string {
    return activityActionLabel(action);
  }

  formatModule(module?: string | null): string {
    return activityModuleLabel(module);
  }

  formatDate(date?: string): string {
    if (!date) return '-';

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatIp(ip?: string): string {
    if (!ip) return '-';

    return ip.replace(/\/\d+$/, '');
  }

  formatEntity(): string {
    if (!this.log.entityType) return '-';

    return this.formatModule(this.log.entityType);
  }

  formatDescription(log: ActivityLog): string {
    return activityDescription(log);
  }

  @HostListener(
    'document:keydown.escape',
    ['$event']
  )
  onEscape(
    event: Event
  ): void {
    event.preventDefault();
    this.onClose();
  }

}
