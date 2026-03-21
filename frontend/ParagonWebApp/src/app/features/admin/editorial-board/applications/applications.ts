import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';

import { ApplicationService } from '../../../../core/services/application.service';
import { Application, ApplicationStatus } from '../../../../models/application.model';
import { ApplicationReviewModal } from '../../../../shared/components/application-review-modal/application-review-modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { JoinService } from '../../../join/services/join.service';
import { JoinPosition } from '../../../join/models/join-position.model';

@Component({
  selector: 'admin-editorial-applications',
  standalone: true,
  imports: [CommonModule, ApplicationReviewModal, ConfirmationModal],
  templateUrl: './applications.html',
})
export class ApplicationsComponent {

  private applicationService = inject(ApplicationService);
  private joinService = inject(JoinService);

  applications$ = this.applicationService.applications$;

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

  // ========================
  // Pipeline Actions
  // ========================

  scheduleInterview(app: Application, date: string) {

    if (!app.id) return;

    this.applicationService.scheduleInterview(app.id, date);

    this.closeModal();
  }

  addNotes(app: Application, notes: string) {

    if (!app.id) return;

    this.applicationService.addInterviewNotes(app.id, notes);
  }

  markInterviewed(app: Application) {

    if (!app.id) return;

    this.applicationService.markInterviewed(app.id);
  }

  accept(app: Application) {

    if (!app.id) return;

    this.applicationService.acceptApplication(app.id);

    this.closeModal();
  }

  reject(app: Application) {

    if (!app.id) return;

    this.applicationService.rejectApplication(app.id);

    this.closeModal();
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
  currentPage = 1;
  pageSize = 5;
  readonly pageSizeOptions = [5, 10, 20, 50];

  setFilter(filter: ApplicationStatus | 'All') {
    this.currentFilter = filter;
    this.currentPage = 1;
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.searchTerm = value;
    this.currentPage = 1;
  }

  onPageSizeChange(event: Event): void {
    const select = event.target as HTMLSelectElement | null;
    if (!select) return;

    const size = Number(select.value);
    if (!Number.isFinite(size) || size <= 0) return;

    this.pageSize = size;
    this.currentPage = 1;
  }

  prevPage(): void {
    this.currentPage = Math.max(1, this.currentPage - 1);
  }

  nextPage(totalPages: number): void {
    this.currentPage = Math.min(totalPages, this.currentPage + 1);
  }

  setPage(page: number): void {
    this.currentPage = Math.max(1, Math.floor(page));
  }

  filteredApplications(apps: Application[]): Application[] {

    let result = apps;

    if (this.currentFilter !== 'All') {
      result = result.filter(a => a.status === this.currentFilter);
    }

    if (this.searchTerm) {

      const term = this.searchTerm.toLowerCase();

      result = result.filter(app =>
        app.fullName.toLowerCase().includes(term) ||
        app.email.toLowerCase().includes(term) ||
        app.studentId.toLowerCase().includes(term)
      );
    }
    return result;
  }

  paginatedApplications(apps: Application[]): Application[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return apps.slice(start, end);
  }

  getTotalPages(totalResults: number): number {
    return Math.max(1, Math.ceil(totalResults / this.pageSize));
  }

  getPageNumbers(totalPages: number): number[] {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  getRangeStart(totalResults: number): number {
    if (totalResults === 0) return 0;
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  getRangeEnd(totalResults: number): number {
    if (totalResults === 0) return 0;
    return Math.min(this.currentPage * this.pageSize, totalResults);
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

  //Interview Calendar Overview
  getUpcomingInterviews(apps: Application[]): Application[] {

    return apps
      .filter(a => a.interviewDate && a.status === 'interview_scheduled')
      .sort((a, b) =>
        new Date(a.interviewDate!).getTime() - new Date(b.interviewDate!).getTime()
      )
      .slice(0, 5);
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

    const header = ['Name', 'Email', 'StudentID', 'Position', 'Subrole', 'Status', 'InterviewDate'];

    const rows = apps.map(app => [
      escapeCsv(app.fullName),
      escapeCsv(app.email),
      escapeCsv(app.studentId),
      escapeCsv(this.getPositionTitle(app.positionId)),
      escapeCsv(this.getSubRoleLabel(app)),
      escapeCsv(app.status ?? ''),
      escapeCsv(app.interviewDate ?? ''),
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


}
