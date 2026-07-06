import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Application } from '../../../models/application.model';
import { JoinPosition } from '../../../features/join/models/join-position.model';

type SelectedApplicationPosition = {
  positionId: string;
  categories: string[];
};

@Component({
  selector: 'application-review-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './application-review-modal.html',
})
export class ApplicationReviewModal implements OnChanges, OnDestroy {

  @Input() application: Application | null = null;
  @Input() positionTitle: string | null = null;
  @Input() subRoleLabel: string | null = null;
  @Input() positions: JoinPosition[] = [];

  @Output() close = new EventEmitter<void>();

  @Output() schedule = new EventEmitter<{ app: Application; date: string }>();
  @Output() notes = new EventEmitter<{ app: Application; notes: string }>();
  @Output() interviewed = new EventEmitter<Application>();
  @Output() accept = new EventEmitter<Application>();
  @Output() reject = new EventEmitter<Application>();

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

  // ==========================
  // Actions
  // ==========================

  ngOnChanges(changes: SimpleChanges): void {
    if (!('application' in changes)) return;

    const isOpen = !!this.application;
    if (isOpen) {
      // Reset local state when opening modal
      this.interviewDate = '';
      this.notesText = '';
      this.lockBodyScroll();
      console.log('Modal opened for application:', this.application?.id);
    } else {
      this.unlockBodyScroll();
      console.log('Modal closed');
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

  acceptWithNotes(app: Application) {
    const notes = this.notesText.trim();
    if (notes) {
      this.notes.emit({ app, notes });
    }
    this.accept.emit(app);
  }

  rejectWithNotes(app: Application) {
    const notes = this.notesText.trim();
    if (notes) {
      this.notes.emit({ app, notes });
    }
    this.reject.emit(app);
  }

  scheduleInterview(app: Application) {
    console.log('Modal scheduleInterview method called', {
      appId: app?.id,
      interviewDate: this.interviewDate,
      interviewDateLength: this.interviewDate?.length,
    });

    if (!app?.id) {
      console.error('Application ID missing');
      return;
    }

    if (!this.interviewDate || this.interviewDate.trim() === '') {
      console.error('No interview date selected', { interviewDate: this.interviewDate });
      return;
    }

    console.log('Emitting schedule event with:', { appId: app.id, date: this.interviewDate });
    this.schedule.emit({
      app,
      date: this.interviewDate
    });
  }

  onInterviewDateInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.interviewDate = input.value;
    console.log('Interview date input changed:', this.interviewDate);
  }

  markInterviewedAndClose(app: Application) {
    this.interviewed.emit(app);
    this.close.emit();
  }
}
