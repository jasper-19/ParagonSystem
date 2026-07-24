import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, HostListener, OnDestroy, ViewChild, inject } from '@angular/core';
import { ActivityLog } from '../../../models/activity-log.model';
import { CommonModule, DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-activity-log-details-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './activity-log-details-modal.html'
})
export class ActivityLogDetailsModalComponent implements AfterViewInit, OnDestroy {

  @Input() log!: ActivityLog;
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
    return (
      this.log.userName?.trim() ||
      'System activity'
    );
  }

  getActorType(): string {
    return this.log.userName
      ? 'Administrator'
      : 'Automated system';
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
    if (!action) return '-';

    const custom: Record<string, string> = {
      LOGIN: 'Logged In',
      LOGOUT: 'Logged Out',
      CREATE: 'Created',
      UPDATE: 'Updated',
      DELETE: 'Deleted',
      PUBLISH: 'Published',
      UNPUBLISH: 'Unpublished',
      SATISFY: 'Updated Satisfaction Status',
      APPROVE: 'Approved',
      REJECT: 'Rejected',
      VERIFY: 'Verified',
      ARCHIVE: 'Archived',
    };

    return custom[action.toUpperCase()]
      ?? action
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
  }

  formatModule(module?: string): string {
    if (!module) return 'System';

    const modules: Record<string, string> = {
      ARTICLES: 'Articles',
      SPECIAL_ISSUES: 'Special Issues',
      MEDIA: 'Media',
      APPLICATIONS: 'Applications',
      STAFF_DIRECTORY: 'Staff Directory',
      EDITORIAL_BOARDS: 'Editorial Board',
      SETTINGS: 'Settings',
      USERS: 'Users',
      AUTH: 'Authentication',
      SYSTEM: 'System',
    };

    return modules[module.toUpperCase()]
      ?? module
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
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

  hasMetadata(): boolean {
      if (!this.log.metadata) return false;

    return Object.keys(this.log.metadata)
      .filter(key => key !== 'description')
      .length > 0;
  }

  metadataEntries():
    Array<{
      key: string;
      value: unknown;
    }> {
    if (!this.log.metadata) {
      return [];
    }

    return Object
      .entries(this.log.metadata)
      .filter(
        ([key]) =>
          key !== 'description'
      )
      .map(([key, value]) => ({
        key:
          this.formatMetadataKey(key),
        value,
      }));
  }

  formatDescription(log: ActivityLog): string {
  const action = log.action?.toUpperCase();
  const module = log.module?.toUpperCase();

  if (module === 'EDITORIAL_BOARDS' && action === 'SATISFY') {
    const satisfied = log.metadata?.['satisfied'];

    if (satisfied === true) {
      return 'Marked the editorial board as satisfied.';
    }

    if (satisfied === false) {
      return 'Marked the editorial board as not satisfied.';
    }

    return 'Updated the editorial board satisfaction status.';
  }

  return log.description
    ?.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'this record')
    ?.replace(/\btrue\b/g, 'Yes')
    ?.replace(/\bfalse\b/g, 'No')
    || 'No description available.';
}

  // Optional: format JSON nicely for display
  formatJSON(data: any): string {
    return JSON.stringify(data, null, 2);
  }

  formatMetadataValue(
    value: unknown
  ): string {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return 'Not recorded';
    }

    if (value === true) {
      return 'Yes';
    }

    if (value === false) {
      return 'No';
    }

    if (
      typeof value === 'object'
    ) {
      try {
        return JSON.stringify(
          value,
          null,
          2
        );
      } catch {
        return 'Unable to display value';
      }
    }

    return String(value)
      .replace(
        /\btrue\b/gi,
        'Yes'
      )
      .replace(
        /\bfalse\b/gi,
        'No'
      );
  }

  formatMetadataKey(
    key: string
  ): string {
    return key
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      );
  }

  isStructuredMetadata(
    value: unknown
  ): boolean {
    return (
      value !== null &&
      typeof value === 'object'
    );
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
