import { Component, EventEmitter, Input, Output, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { Application } from '../../../models/application.model';

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
      this.lockBodyScroll();
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

    if (!this.interviewDate) return;

    this.schedule.emit({
      app,
      date: this.interviewDate
    });
  }

}
