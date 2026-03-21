import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';

import { JoinApplication } from '../../features/join/models/join-application.model';
import { Application } from '../../models/application.model';

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {

  private readonly apiUrl = '/api/applications';

  private applicationsSubject = new BehaviorSubject<Application[]>([]);
  readonly applications$ = this.applicationsSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadApplications();
  }

  private parseDates(app: any): Application {
    return {
      ...app,
      createdAt: app.createdAt ? new Date(app.createdAt) : undefined,
      interviewDate: app.interviewDate ? new Date(app.interviewDate) : undefined,
    };
  }

  // ====================================
  // Data Loading
  // ====================================

  private loadApplications(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: apps => this.applicationsSubject.next(apps.map(a => this.parseDates(a))),
      error: err => console.error('Failed to load applications:', err)
    });
  }

  refresh(): void {
    this.loadApplications();
  }

  // ====================================
  // Submit Application
  // ====================================

  submit(application: JoinApplication): Observable<Application> {
    return this.http.post<any>(this.apiUrl, application).pipe(
      tap(newApp => {
        const parsed = this.parseDates(newApp);
        this.applicationsSubject.next([parsed, ...this.applicationsSubject.value]);
      })
    );
  }

  // ====================================
  // Admin Utilities
  // ====================================

  getAll(): Application[] {
    return this.applicationsSubject.value;
  }

  getById(id: string): Application | undefined {
    return this.applicationsSubject.value.find(app => app.id === id);
  }

  updateStatus(id: string, status: Application['status']): void {
    if (!status) return;
    this.patchStatus(id, status);
  }

  // ================================
  // Editorial Board Pipeline
  // ================================

  private patchStatus(
    id: string,
    status: Application['status'],
    localChanges: Partial<Application> = {}
  ): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/status`, { status }).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        const apps = this.applicationsSubject.value.map(app =>
          app.id === id ? { ...app, ...parsed, ...localChanges } : app
        );
        this.applicationsSubject.next(apps);
      },
      error: err => console.error('Failed to update status:', err)
    });
  }

  private updateLocalApplication(id: string, changes: Partial<Application>): void {
    const apps = this.applicationsSubject.value.map(app =>
      app.id === id ? { ...app, ...changes } : app
    );
    this.applicationsSubject.next(apps);
  }

  scheduleInterview(id: string, datetime: string): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/interview`, { interviewDate: datetime }).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        this.updateLocalApplication(id, parsed);
      },
      error: err => console.error('Failed to schedule interview:', err)
    });
  }

  clearInterview(id: string): void {
    this.patchStatus(id, 'pending', {
      interviewDate: null
    });
  }

  addInterviewNotes(id: string, notes: string): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/interview-notes`, { notes }).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        this.updateLocalApplication(id, parsed);
      },
      error: err => console.error('Failed to save interview notes:', err)
    });
  }

  markInterviewed(id: string): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/interview-complete`, {}).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        this.updateLocalApplication(id, parsed);
      },
      error: err => console.error('Failed to mark as interviewed:', err)
    });
  }

  acceptApplication(id: string, interviewNotes?: string): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/accept`, { interviewNotes }).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        this.updateLocalApplication(id, parsed);
      },
      error: err => console.error('Failed to accept application:', err)
    });
  }

  rejectApplication(id: string): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/reject`, {}).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        this.updateLocalApplication(id, parsed);
      },
      error: err => console.error('Failed to reject application:', err)
    });
  }

  markAssigned(id: string, section: string, role: string): void {
    this.http.patch<any>(`${this.apiUrl}/${id}/assign`, { section, role }).subscribe({
      next: updated => {
        const parsed = this.parseDates(updated);
        this.updateLocalApplication(id, parsed);
      },
      error: err => console.error('Failed to assign application:', err)
    });
  }

  getUnassignedAccepted(): Application[] {
    return this.applicationsSubject.value.filter(app =>
      app.status === 'accepted' && !app.assigned
    );
  }

  revokeAcceptance(id: string): void {
    this.patchStatus(id, 'interview_completed');
  }

  deleteApplication(id: string): void {
    this.http.delete(`${this.apiUrl}/${id}`).subscribe({
      next: () => {
        this.applicationsSubject.next(
          this.applicationsSubject.value.filter(app => app.id !== id)
        );
      },
      error: err => console.error('Failed to delete application:', err),
    });
  }
}

