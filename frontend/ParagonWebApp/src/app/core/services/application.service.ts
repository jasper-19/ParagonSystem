import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { JoinApplication } from '../../features/join/models/join-application.model';
import { Application } from '../../models/application.model';
import { ApplicationSettings, UpdateApplicationSettings } from '../../models/application-settings.model';

import { API_ENDPOINTS } from '../config/api.config';

import { SocketService } from './socket.service';

export interface PaginatedApplications {
  items: Application[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

type DefinedApplicationStatus =
  Exclude<Application['status'], null | undefined>;

@Injectable({
  providedIn: 'root'
})
export class ApplicationService {

  // Base API endpoint for application-related calls
  private readonly apiUrl = API_ENDPOINTS.applications;

  // Internal subject holding the current list of applications
  private applicationsSubject = new BehaviorSubject<Application[]>([]);
  readonly applications$ = this.applicationsSubject.asObservable();

  private readonly applicationSettingsSubject = new BehaviorSubject<ApplicationSettings | null>(null);

  private lastStatus: string | undefined;
  private lastSearch: string | undefined;

  private applicationsRefreshInProgress = false;
  private applicationsRefreshPending = false;

  private settingsRefreshInProgress = false;

  readonly applicationSettings$ = this.applicationSettingsSubject.asObservable();

  readonly total = signal(0);
  readonly totalPages = signal(1);
  readonly currentPage = signal(1);
  readonly pageSize = signal(10);

  readonly totalApplications = this.total.asReadonly();
  readonly totalPagesCount = this.totalPages.asReadonly();
  readonly activePage = this.currentPage.asReadonly();
  readonly activePageSize = this.pageSize.asReadonly();

  constructor(
    private http: HttpClient,
    private socketService: SocketService
  ) {
    this.initializeRealtime();
  }

  private initializeRealtime(): void {
    this.socketService
      .onApplicationsUpdated(() => {
        console.log(
          '📡 Applications updated'
        );

        this.refresh();
      });

    this.socketService
      .onEditorialBoardUpdated(() => {
        console.log(
          '📡 Editorial board changed application assignment state'
        );

        this.refresh();
      });

    this.socketService
      .onApplicationSettingsUpdated(
        () => {
          console.log(
            '📡 Application settings updated'
          );

          this.refreshApplicationSettings();
        }
      );
  }

  // Convert plain objects from the API into Application instances with Date fields
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

  private loadApplications(
    page = 1,
    limit = 10,
    status?: string,
    search?: string
  ): void {

    let params = new HttpParams()
      .set('page', page)
      .set('limit', limit);

    if (status) {
      params = params.set('status', status);
    }

    if (search) {
      params = params.set('search', search);
    }

    this.http
      .get<PaginatedApplications>(
        this.apiUrl,
        { params }
      )
      .pipe(
        finalize(() => {
          this.applicationsRefreshInProgress =
            false;

          if (
            this.applicationsRefreshPending
          ) {
            this.applicationsRefreshPending =
              false;

            this.requestApplicationsRefresh(
              this.currentPage(),
              this.pageSize(),
              this.lastStatus,
              this.lastSearch
            );
          }
        })
      )
      .subscribe({
        next: response => {
          this.currentPage.set(response.page);
          this.pageSize.set(response.limit);
          this.total.set(response.total);
          this.totalPages.set(
            response.totalPages
          );

          this.applicationsSubject.next(
            response.items.map(app =>
              this.parseDates(app)
            )
          );
        },

        error: error => {
          console.error(
            'Failed to load applications:',
            error
          );
        },
      });
  }

  private requestApplicationsRefresh(
    page: number,
    limit: number,
    status?: string,
    search?: string
  ): void {
    if (this.applicationsRefreshInProgress) {
      this.applicationsRefreshPending = true;
      return;
    }

    this.applicationsRefreshInProgress = true;

    this.loadApplications(
      page,
      limit,
      status,
      search
    );
  }

  refresh(
    page = this.currentPage(),
    limit = this.pageSize(),
    status = this.lastStatus,
    search = this.lastSearch
  ): void {
    this.lastStatus = status;
    this.lastSearch = search;

    this.requestApplicationsRefresh(
      page,
      limit,
      status,
      search
    );
  }

  // ====================================
  // Submit Application
  // ====================================

  submit(application: JoinApplication): Observable<Application> {
    return this.http.post<any>(this.apiUrl, application).pipe(
      tap(newApp => {
        const parsed = this.parseDates(newApp);
        // Prepend the newly created application to the current list
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

  updateStatus(
    id: string,
    status: DefinedApplicationStatus
  ): Observable<Application> {
    return this.patchStatus(id, status);
  }

  // ================================
  // Editorial Board Pipeline
  // ================================

  private patchStatus(
    id: string,
    status: Application['status'],
    localChanges: Partial<Application> = {}
  ): Observable<Application> {
    return this.http
      .patch<Application>(
        `${this.apiUrl}/${id}/status`,
        { status }
      )
      .pipe(
        tap(updated => {
          const parsed = this.parseDates(updated);

          this.updateLocalApplication(id, {
            ...parsed,
            ...localChanges,
          });
        })
      );
  }

  private updateLocalApplication(id: string, changes: Partial<Application>): void {
    const apps = this.applicationsSubject.value.map(app =>
      app.id === id ? { ...app, ...changes } : app
    );
    this.applicationsSubject.next(apps);
  }

scheduleInterview(
  id: string,
  datetime: string
): Observable<Application> {
  return this.http
    .patch<Application>(
      `${this.apiUrl}/${id}/interview`,
      {
        interviewDate: datetime,
      }
    )
    .pipe(
      tap(updated => {
        const parsed =
          this.parseDates(updated);

        this.updateLocalApplication(
          id,
          parsed
        );
      })
    );
}

  clearInterview(
    id: string
  ): Observable<Application> {
    return this.patchStatus(
      id,
      'pending',
      {
        interviewDate: null,
      }
    );
  }

addInterviewNotes(
  id: string,
  notes: string
): Observable<Application> {
  return this.http
    .patch<Application>(
      `${this.apiUrl}/${id}/interview-notes`,
      {
        notes,
      }
    )
    .pipe(
      tap(updated => {
        const parsed =
          this.parseDates(updated);

        this.updateLocalApplication(
          id,
          parsed
        );
      })
    );
}

markInterviewed(
  id: string
): Observable<Application> {
  return this.http
    .patch<Application>(
      `${this.apiUrl}/${id}/interview-complete`,
      {}
    )
    .pipe(
      tap(updated => {
        const parsed =
          this.parseDates(updated);

        this.updateLocalApplication(
          id,
          parsed
        );
      })
    );
}

acceptApplication(
  id: string,
  interviewNotes?: string
): Observable<Application> {
  return this.http
    .patch<Application>(
      `${this.apiUrl}/${id}/accept`,
      {
        interviewNotes,
      }
    )
    .pipe(
      tap(updated => {
        const parsed =
          this.parseDates(updated);

        this.updateLocalApplication(
          id,
          parsed
        );
      })
    );
}

rejectApplication(
  id: string,
  interviewNotes?: string
): Observable<Application> {
  return this.http
    .patch<Application>(
      `${this.apiUrl}/${id}/reject`,
      {
        interviewNotes,
      }
    )
    .pipe(
      tap(updated => {
        const parsed =
          this.parseDates(updated);

        this.updateLocalApplication(
          id,
          parsed
        );
      })
    );
}

  markAssigned(
    id: string,
    section: string,
    role: string
  ): Observable<Application> {
    return this.http
      .patch<Application>(
        `${this.apiUrl}/${id}/assign`,
        {
          section,
          role,
        }
      )
      .pipe(
        tap(updated => {
          const parsed =
            this.parseDates(updated);

          this.updateLocalApplication(
            id,
            parsed
          );
        })
      );
  }

  getUnassignedAccepted(): Application[] {
    return this.applicationsSubject.value.filter(app =>
      app.status === 'accepted' && !app.assigned
    );
  }

  revokeAcceptance(
    id: string
  ): Observable<Application> {
    return this.patchStatus(
      id,
      'interview_completed'
    );
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

  getApplicationSettings(): Observable<ApplicationSettings> {
    return this.http
      .get<ApplicationSettings>(`${this.apiUrl}/settings`)
      .pipe(
        tap(settings => {
          this.applicationSettingsSubject.next(settings);
        })
      );
  }

  updateApplicationSettings(
    patch: UpdateApplicationSettings
  ): Observable<ApplicationSettings> {
    return this.http
      .patch<ApplicationSettings>(
        `${this.apiUrl}/settings`,
        patch
      )
      .pipe(
        tap(settings => {
          this.applicationSettingsSubject.next(
            settings
          );
        })
      );
  }

  refreshApplicationSettings(): void {
    if (this.settingsRefreshInProgress) return;

    this.settingsRefreshInProgress = true;

    this.getApplicationSettings()
      .pipe(
        finalize(() => {
          this.settingsRefreshInProgress = false;
        })
      )
      .subscribe({
        error: err =>
          console.error(
            'Failed to refresh application settings:',
            err
          ),
      });
  }
}

