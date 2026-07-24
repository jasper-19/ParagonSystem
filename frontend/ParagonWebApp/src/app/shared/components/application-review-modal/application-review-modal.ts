import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges, ElementRef, HostListener, ViewChild, AfterViewInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Application } from '../../../models/application.model';
import { JoinPosition } from '../../../features/join/models/join-position.model';

type SelectedApplicationPosition = {
  positionId: string;
  categories: string[];
};

type ApplicationStage = { key: | 'pending' | 'interview_scheduled' | 'interview_completed' | 'accepted' | 'rejected'; label: string };

export type ApplicationReviewAction = 'schedule' | 'interviewed' | 'accept' | 'reject' | null;

@Component({
  selector: 'application-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './application-review-modal.html',
})
export class ApplicationReviewModal implements OnChanges, OnDestroy, AfterViewInit {

  @Input() application: Application | null = null;
  @Input() positionTitle: string | null = null;
  @Input() subRoleLabel: string | null = null;
  @Input() positions: JoinPosition[] = [];
  @Input() activeAction: ApplicationReviewAction = null;
  @Input() actionError = '';

  @Output() close = new EventEmitter<void>();

  @Output() schedule = new EventEmitter<{ app: Application; date: string }>();
  @Output() notes = new EventEmitter<{ app: Application; notes: string }>();
  @Output() interviewed = new EventEmitter<Application>();

  @Output() accept =
    new EventEmitter<{
      app: Application;
      notes: string;
    }>();

  @Output() reject =
    new EventEmitter<{
      app: Application;
      notes: string;
    }>();

  @ViewChild('dialogContainer')
  private dialogContainer?: ElementRef<HTMLElement>;

  @ViewChild('closeButton')
  private closeButton?: ElementRef<HTMLButtonElement>;

  readonly applicationStages: ApplicationStage[] = [
    {
      key: 'pending',
      label: 'Submitted',
    },
    {
      key: 'interview_scheduled',
      label: 'Interview Scheduled',
    },
    {
      key: 'interview_completed',
      label: 'Interview Completed',
    },
    {
      key: 'accepted',
      label: 'Accepted',
    },
  ];

  readonly isClosing = signal(false);

  private closeAnimationTimer?:
    ReturnType<typeof setTimeout>;

  private readonly closeAnimationDuration = 180;

  readonly emailCopied = signal(false);

  private copyStatusTimer?: ReturnType<typeof setTimeout>;

  private previouslyFocusedElement:
    HTMLElement | null = null;

  private viewInitialized = false;

  private savedNotesText = '';

  // ==========================
  // Local Modal State
  // ==========================

  interviewDate: string = '';
  notesText: string = '';

  private previousBodyOverflow: string | null = null;
  private isScrollLocked = false;

  // ==========================
  // Stage Helpers
  // ==========================

  getSelectedPositions(app: Application): SelectedApplicationPosition[] {
    if (app.selectedPositions?.length) {
      return app.selectedPositions;
    }

    if (app.positionId) {
      return [
        {
          positionId: app.positionId,
          categories: app.subRole ? [app.subRole] : [],
        },
      ];
    }

    return [];
  }

  positionLabel(positionId?: string): string {
    if (!positionId) return '—';
    return this.positions.find(p => p.id === positionId)?.title ?? positionId;
  }

  isPending(app: Application) {
    return (app.status ?? 'pending') === 'pending';
  }

  isScheduled(app: Application) {
    return app.status === 'interview_scheduled';
  }

  isInterviewed(app: Application) {
    return app.status === 'interview_completed';
  }

  hasInterviewNotesStage(app: Application): boolean {
    return (
      app.status === 'interview_completed' ||
      app.status === 'accepted' ||
      app.status === 'rejected'
    );
  }

  isActionPending(
    action: Exclude<ApplicationReviewAction, null>
  ): boolean {
    return this.activeAction === action;
  }

  get hasPendingAction(): boolean {
    return this.activeAction !== null;
  }

  private readonly YEAR_LEVEL_LABELS: Record<string, string> = {
    '1st_year':    '1st Year',
    '2nd_year':    '2nd Year',
    '3rd_year':    '3rd Year',
    '4th_year':    '4th Year',
    'unspecified': '—',
  };

  yearLevelLabel(value: string | undefined): string {
    if (!value) return '—';
    return this.YEAR_LEVEL_LABELS[value] ?? value;
  }

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
      typeof document === 'undefined' ||
      !document.contains(target)
    ) {
      return;
    }

    queueMicrotask(() => {
      target.focus({
        preventScroll: true
      });
    });
}

  private readonly stageOrder: Record<
    Exclude<ApplicationStage['key'], 'rejected'>,
    number
  > = {
    pending: 0,
    interview_scheduled: 1,
    interview_completed: 2,
    accepted: 3,
  };

  isRejected(app: Application): boolean {
    return app.status === 'rejected';
  }

  isStageComplete(
    app: Application,
    stage: ApplicationStage
  ): boolean {
    const status = app.status ?? 'pending';

    if (status === 'rejected') {
      return false;
    }

    const currentIndex =
      this.stageOrder[
        status as keyof typeof this.stageOrder
      ];

    const stageIndex =
      this.stageOrder[
        stage.key as keyof typeof this.stageOrder
      ];

    if (
      currentIndex === undefined ||
      stageIndex === undefined
    ) {
      return false;
    }

    // Accepted is a finished pipeline, so every stage,
    // including Accepted, displays as completed.
    if (status === 'accepted') {
      return stageIndex <= currentIndex;
    }

    // For in-progress states, only earlier stages
    // display as completed.
    return stageIndex < currentIndex;
  }

  isCurrentStage(
    app: Application,
    stage: ApplicationStage
  ): boolean {
    const status = app.status ?? 'pending';

    if (
      status === 'accepted' ||
      status === 'rejected'
    ) {
      return false;
    }

    return status === stage.key;
  }

  private parseInterviewDate(
    value: string | Date | null | undefined
  ): Date | null {
    if (!value) {
      return null;
    }

    const date =
      value instanceof Date
        ? value
        : new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  get hasUnsavedNotes(): boolean {
    return (
      this.notesText.trim() !==
      this.savedNotesText
    );
  }

  // ==========================
  // Actions
  // ==========================

  ngOnChanges(
    changes: SimpleChanges
  ): void {
    if (!changes['application']) {
      return;
    }

    if (this.application) {
      this.isClosing.set(false);
      this.interviewDate = '';

      const existingNotes =
        this.application.interviewNotes?.trim() ?? '';

      this.notesText = existingNotes;
      this.savedNotesText = existingNotes;

      this.previouslyFocusedElement =
        typeof document !== 'undefined' &&
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;

      this.lockBodyScroll();

      if (this.viewInitialized) {
        this.focusInitialElement();
      }

      return;
    }

    this.unlockBodyScroll();
    this.restorePreviousFocus();
  }

  ngOnDestroy(): void {
    clearTimeout(
      this.closeAnimationTimer
    );

    clearTimeout(
      this.copyStatusTimer
    );

    this.unlockBodyScroll();
    this.restorePreviousFocus();
  }

    ngAfterViewInit(): void {
      this.viewInitialized = true;

      if (this.application) {
        this.focusInitialElement();
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
  }

  acceptWithNotes(
    app: Application
  ): void {
    if (this.hasPendingAction) {
      return;
    }

    this.accept.emit({
      app,
      notes: this.notesText.trim(),
    });
  }

  rejectWithNotes(
    app: Application
  ): void {
    if (this.hasPendingAction) {
      return;
    }

    this.reject.emit({
      app,
      notes: this.notesText.trim(),
    });
  }

  scheduleInterview(app: Application): void {
    if (
      this.hasPendingAction ||
      !app.id ||
      !this.interviewDate.trim()
    ) {
      return;
    }

  this.schedule.emit({
    app,
    date: this.interviewDate,
  });
}

  onInterviewDateInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.interviewDate = input.value;
    console.log('Interview date input changed:', this.interviewDate);
  }

  markInterviewedAndClose(
    app: Application
  ): void {
    if (this.hasPendingAction) {
      return;
    }

    this.interviewed.emit(app);
  }

  requestClose(): void {
    if (
      this.hasPendingAction ||
      this.isClosing()
    ) {
      return;
    }

    if (this.prefersReducedMotion()) {
      this.close.emit();
      return;
    }

    this.isClosing.set(true);

    clearTimeout(
      this.closeAnimationTimer
    );

    this.closeAnimationTimer =
      setTimeout(() => {
        this.close.emit();
      }, this.closeAnimationDuration);
  }

onDialogKeydown(
  event: Event
): void {
  if (!(event instanceof KeyboardEvent)) {
    return;
  }

  if (event.key !== 'Tab') {
    return;
  }

  const dialog =
    this.dialogContainer?.nativeElement;

  if (!dialog) {
    return;
  }

  const focusable = Array.from(
    dialog.querySelectorAll<HTMLElement>([
      'button:not([disabled])',
      'input:not([disabled])',
      'textarea:not([disabled])',
      'select:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])'
    ].join(','))
  ).filter(element =>
    element.offsetParent !== null &&
    element.getAttribute('aria-hidden') !== 'true'
  );

  if (!focusable.length) {
    event.preventDefault();
    dialog.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[
    focusable.length - 1
  ];

  const active =
    document.activeElement;

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

  statusLabel(
    status: Application['status']
  ): string {
    if (!status) {
      return 'Pending';
    }

    return status
      .replace(/_/g, ' ')
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      );
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (!this.application) {
      return;
    }

    this.requestClose();
  }

formatInterviewDate(
  value: string | Date | null | undefined
): string {
  if (!value) return '—';

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

  async copyEmail(
    email: string
  ): Promise<void> {
    if (!email) {
      return;
    }

    try {
      await navigator.clipboard.writeText(email);

      this.emailCopied.set(true);

      clearTimeout(this.copyStatusTimer);

      this.copyStatusTimer = setTimeout(() => {
        this.emailCopied.set(false);
      }, 2000);
    } catch {
      this.emailCopied.set(false);
    }
  }

  formatInterviewWeekday(
    value: string | Date | null | undefined
  ): string {
    const date = this.parseInterviewDate(value);

    if (!date) {
      return '—';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'long',
    });
  }

  formatInterviewFullDate(
    value: string | Date | null | undefined
  ): string {
    const date = this.parseInterviewDate(value);

    if (!date) {
      return '—';
    }

    return date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatInterviewTime(
    value: string | Date | null | undefined
  ): string {
    const date = this.parseInterviewDate(value);

    if (!date) {
      return '—';
    }

    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  get notesStatusLabel(): string {
    return this.hasUnsavedNotes
      ? 'Unsaved changes'
      : 'Saved';
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches
    );
  }

}
