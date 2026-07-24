import { FormsModule } from '@angular/forms';
import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs/operators';
import { Subject, debounceTime, distinctUntilChanged, map } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { ApplicationService } from '../../../../core/services/application.service';
import { Application, ApplicationStatus } from '../../../../models/application.model';
import { ApplicationReviewModal, ApplicationReviewAction } from '../../../../shared/components/application-review-modal/application-review-modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { JoinService } from '../../../join/services/join.service';
import { JoinPosition } from '../../../join/models/join-position.model';
import { ApplicationSettings, UpdateApplicationSettings } from '../../../../models/application-settings.model';

type SelectedApplicationPosition = {
  positionId: string;
  categories: string[];
};
@Component({
  selector: 'admin-editorial-applications',
  standalone: true,
  imports: [CommonModule, FormsModule, ApplicationReviewModal, ConfirmationModal],
  templateUrl: './applications.html',
})
export class ApplicationsComponent implements OnInit {

  readonly applicationSettings = signal<ApplicationSettings | null>(null);

  readonly settingsLoading = signal(false);
  readonly settingsSaving = signal(false);

  readonly announcementDraft = signal('');
  readonly settingsError = signal('');

  readonly reviewAction =
    signal<ApplicationReviewAction>(null);

  readonly reviewActionError =
    signal('');

  showSettingsConfirm = false;
  pendingSettingsAction: 'open' | 'close' | null = null;


  private applicationService = inject(ApplicationService);
  private joinService = inject(JoinService);
  private destroyRef = inject(DestroyRef);
  private readonly searchChanges = new Subject<string>();

  applications$ = this.applicationService.applications$;

  readonly totalResults = this.applicationService.totalApplications;
  readonly totalPages = this.applicationService.totalPagesCount;
  readonly activePage = this.applicationService.activePage;
  readonly activePageSize = this.applicationService.activePageSize;

  readonly announcementDirty = signal(false);

  ngOnInit(): void {
    this.loadApplications();
    this.loadApplicationSettings();

    this.searchChanges
      .pipe(
        map(value => value.trim()),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(search => {
        this.applicationService.refresh(
          1,
          this.activePageSize(),
          this.currentFilter === 'All'
            ? undefined
            : this.currentFilter,
          search || undefined
        );
      });

    this.applicationService.applicationSettings$
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(settings => {
        if (!settings) return;

        this.applicationSettings.set(settings);

        if (!this.announcementDirty()) {
          this.announcementDraft.set(
            settings.announcement
          );
        }
      });


  }

  private loadApplicationSettings(): void {
    this.settingsLoading.set(true);
    this.settingsError.set('');

    this.applicationService
      .getApplicationSettings()
      .pipe(
        finalize(() => {
          this.settingsLoading.set(false);
        })
      )
      .subscribe({
        error: err => {
          console.error(
            'Failed to load application settings',
            err
          );

          this.settingsError.set('Unable to load application form settings.');
        },
      });
  }

  private loadApplications(): void {
    this.applicationService.refresh(
      this.activePage(),
      this.activePageSize(),
      this.currentFilter === 'All' ? undefined : this.currentFilter,
      this.searchTerm.trim() || undefined
    );
  }

  readonly positions = toSignal(this.joinService.getOpenPositions(), {
    initialValue: [] as JoinPosition[],
  });

  selectedApplication: Application | null = null;

  // ========================
  // Delete Confirmation Modal
  // ========================

  appToDelete: Application | null = null;
  showDeleteConfirm = false;
  deleteMessage = '';

  requestDelete(app: Application, event: Event): void {
    event.stopPropagation();
    this.appToDelete = app;
    this.deleteMessage = `Are you sure you want to permanently remove the application from ${app.fullName}? This action cannot be undone.`;
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    if (!this.appToDelete?.id) return;
    this.applicationService.deleteApplication(this.appToDelete.id);
    this.showDeleteConfirm = false;
    this.appToDelete = null;
    this.deleteMessage = '';
  }

  cancelDelete(): void {
    this.showDeleteConfirm = false;
    this.appToDelete = null;
    this.deleteMessage = '';
  }

  // ========================
  // Modal Control
  // ========================

  openApplication(app: Application) {
    this.selectedApplication = app;
  }

  closeModal() {
    this.selectedApplication = null;
  }

  openApplicationFromKeyboard(
    event: Event,
    app: Application
  ): void {
    event.preventDefault();
    event.stopPropagation();
    this.openApplication(app);
  }

  // ========================
  // Pipeline Actions
  // ========================

  scheduleInterview(
    app: Application,
    date: string
  ): void {
    if (
      !app.id ||
      this.reviewAction()
    ) {
      return;
    }

    this.reviewAction.set('schedule');
    this.reviewActionError.set('');

    this.applicationService
      .scheduleInterview(
        app.id,
        date
      )
      .pipe(
        finalize(() => {
          this.reviewAction.set(null);
        })
      )
      .subscribe({
        next: updated => {
          this.selectedApplication =
            updated;

          this.closeModal();
        },
        error: error => {
          this.reviewActionError.set(
            error?.error?.error ??
            'Unable to schedule the interview.'
          );
        },
      });
  }

  addNotes(app: Application, notes: string) {

    if (!app.id) return;

    this.applicationService.addInterviewNotes(app.id, notes);
  }

  markInterviewed(
    app: Application
  ): void {
    if (
      !app.id ||
      this.reviewAction()
    ) {
      return;
    }

    this.reviewAction.set('interviewed');
    this.reviewActionError.set('');

    this.applicationService
      .markInterviewed(app.id)
      .pipe(
        finalize(() => {
          this.reviewAction.set(null);
        })
      )
      .subscribe({
        next: updated => {
          this.selectedApplication =
            updated;
        },
        error: error => {
          this.reviewActionError.set(
            error?.error?.error ??
            'Unable to mark the interview as completed.'
          );
        },
      });
  }

  accept(
    app: Application,
    notes: string
  ): void {
    if (
      !app.id ||
      this.reviewAction()
    ) {
      return;
    }

    this.reviewAction.set('accept');
    this.reviewActionError.set('');

    this.applicationService
      .acceptApplication(
        app.id,
        notes || undefined
      )
      .pipe(
        finalize(() => {
          this.reviewAction.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.closeModal();
        },
        error: error => {
          this.reviewActionError.set(
            error?.error?.error ??
            'Unable to accept the application.'
          );
        },
      });
  }

  reject(
    app: Application,
    notes: string
  ): void {
    if (
      !app.id ||
      this.reviewAction()
    ) {
      return;
    }

    this.reviewAction.set('reject');
    this.reviewActionError.set('');

    this.applicationService
      .rejectApplication(
        app.id,
        notes || undefined
      )
      .pipe(
        finalize(() => {
          this.reviewAction.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.closeModal();
        },
        error: error => {
          this.reviewActionError.set(
            error?.error?.error ??
            'Unable to reject the application.'
          );
        },
      });
  }

  // Search & Filter State
  statuses: Array<ApplicationStatus | 'All'> = [
    'All',
    'pending',
    'interview_scheduled',
    'interview_completed',
    'accepted',
    'rejected',
  ];

  currentFilter: ApplicationStatus | 'All' = 'All';
  searchTerm = '';

  // Pagination
  readonly pageSizeOptions = [10, 20, 50];

  setFilter(filter: ApplicationStatus | 'All') {
    this.currentFilter = filter;
    this.applicationService.refresh(
      1,
      this.activePageSize(),
      filter === 'All' ? undefined : filter,
      this.searchTerm.trim() || undefined
    );
  }

  onSearch(event: Event): void {
    const value =
      (event.target as HTMLInputElement | null)
        ?.value ?? '';

    this.searchTerm = value;
    this.searchChanges.next(value);
  }

  clearSearch(): void {
    if (!this.searchTerm) {
      return;
    }

    this.searchTerm = '';
    this.searchChanges.next('');
  }

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;

    const size = Number(select.value);
    if (!Number.isFinite(size) || size <= 0) return;

    this.applicationService.refresh(
      1,
      size,
      this.currentFilter === 'All' ? undefined : this.currentFilter,
      this.searchTerm.trim() || undefined
    );
  }

  prevPage(): void {
    this.goToPage(Math.max(1, this.activePage() - 1));
  }

  nextPage(): void {
    this.goToPage(Math.min(this.totalPages(), this.activePage() + 1));
  }

  setPage(page: number): void {
    this.goToPage(page);
  }

  private goToPage(page: number): void {
    this.applicationService.refresh(
      page,
      this.activePageSize(),
      this.currentFilter === 'All' ? undefined : this.currentFilter,
      this.searchTerm.trim() || undefined
    );
  }


  getRangeStart(): number {
    if (this.totalResults() === 0) return 0;
    return (this.activePage() - 1) * this.activePageSize() + 1;
  }

  getRangeEnd(): number {
    if (this.totalResults() === 0) return 0;
    return Math.min(this.activePage() * this.activePageSize(), this.totalResults());
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.activePage();
    const radius = 2;

    const start = Math.max(
      1,
      current - radius
    );

    const end = Math.min(
      total,
      current + radius
    );

    return Array.from(
      { length: end - start + 1 },
      (_, index) => start + index
    );
  }

  // ========================
  // Position / Subrole Labels
  // ========================


  readonly YEAR_LEVEL_LABELS: Record<string, string> = {
    '1st_year':   '1st Year',
    '2nd_year':   '2nd Year',
    '3rd_year':   '3rd Year',
    '4th_year':   '4th Year',
    'unspecified': '—',
  };


  getYearLevelLabel(value: string | undefined): string {
    if (!value) return '—';
    return this.YEAR_LEVEL_LABELS[value] ?? value;
  }

  getPositionTitle(positionId: string): string {
    const pos = this.positions().find(p => p.id === positionId);
    return pos?.title ?? positionId;
  }

  getSubRoleLabel(app: Application): string {
    const raw = (app.subRole ?? '').trim();
    if (!raw) return '—';

    const pos = this.positions().find(p => p.id === app.positionId);
    const valid = pos?.subRoles?.some(s => s.name === raw) ?? false;
    return valid ? raw : '—';
  }

  // Display Formatters
  formatStatus(status: ApplicationStatus | undefined): string {
    if (!status) return '—';

    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  formatInterviewDate(date: string | Date | null | undefined): string {
    if (!date) return '—';

    const parsed = date instanceof Date ? date : new Date(date);

    if (Number.isNaN(parsed.getTime())) return '—';

    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatTabLabel(status: ApplicationStatus | 'All'): string {
    return status === 'All'
    ? 'All'
    : this.formatStatus(status);
  }

  //Interview Calendar Overview
  getUpcomingInterviews(apps: Application[]): Application[] {

    return apps
      .filter(a => a.interviewDate && a.status === 'interview_scheduled')
      .sort((a, b) =>
        new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime()
      )
      .slice(0, 5);
  }

  getSelectedPositions(app: Application): SelectedApplicationPosition[] {
    if (app.selectedPositions?.length) {
      return app.selectedPositions;
    }

    // Legacy fallback for old applications
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

  getPositionCategoryDisplay(app: Application): string {
    const selected = this.getSelectedPositions(app);

    if (selected.length === 0) return '—';

    return selected
      .map(item => {
        const title = this.getPositionTitle(item.positionId);
        const categories = item.categories?.length
          ? item.categories.join(', ')
          : 'No category';

        return `${title} (${categories})`;
      })
      .join('; ');
  }

  //CSV export
  exportApplications(apps: Application[]) {

    const escapeCsv = (value: unknown): string => {
      const text = String(value ?? '');
      if (/[\n\r",]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };

    const header = ['Name', 'Email', 'StudentID', 'Positions & Categories', 'Status', 'InterviewDate'];

    const rows = apps.map(app => [
      escapeCsv(app.fullName),
      escapeCsv(app.email),
      escapeCsv(app.studentId),escapeCsv(this.getPositionCategoryDisplay(app)),
      escapeCsv(this.getPositionCategoryDisplay(app)),
      escapeCsv(this.formatStatus(app.status)),
      escapeCsv(this.formatInterviewDate(app.interviewDate)),
    ]);

    const csvContent = [header.join(','), ...rows.map(r => r.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'applications.csv';
    anchor.click();

    window.URL.revokeObjectURL(url);
  }

  //Admin Actions
  requestApplicationWindowChange(
    action: 'open' | 'close'
  ): void {
    this.pendingSettingsAction = action;
    this.showSettingsConfirm = true;
  }

  cancelApplicationWindowChange(): void {
    this.pendingSettingsAction = null;
    this.showSettingsConfirm = false;
  }

  confirmApplicationWindowChange(): void {
    const action = this.pendingSettingsAction;

    if (!action) return;

    this.showSettingsConfirm = false;
    this.pendingSettingsAction = null;

    this.saveApplicationSettings({
      isOpen: action === 'open',
      announcement: this.announcementDraft().trim(),
    });
  }

  saveAnnouncement(): void {
    this.saveApplicationSettings({
      announcement: this.announcementDraft().trim(),
    });
  }

  onAnnouncementChange(value: string): void {
    this.announcementDraft.set(value);
    this.announcementDirty.set(true);
  }

  private saveApplicationSettings(
    patch: UpdateApplicationSettings
  ): void {
    if (this.settingsSaving()) return;

    const announcement = patch.announcement?.trim();

    if (
      announcement !== undefined &&
      announcement.length < 10
    ) {
      this.settingsError.set(
        'Announcement must be at least 10 characters long.'
      );
      return;
    }

    this.settingsSaving.set(true);
    this.settingsError.set('');

    this.applicationService
      .updateApplicationSettings(patch)
      .pipe(
        finalize(() => {
          this.settingsSaving.set(false);
        })
      )
      .subscribe({
        next: settings => {
          this.applicationSettings.set(settings);
          this.announcementDraft.set(settings.announcement);
          this.announcementDirty.set(false);
        },
        error: err => {
          console.error('Failed to save application settings', err);

          this.settingsError.set(
            err.error?.error ??
            'Unable to save application settings.'
          );
        },
      });
  }
}
