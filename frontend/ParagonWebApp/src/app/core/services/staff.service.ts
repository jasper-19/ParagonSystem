import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, map, finalize, forkJoin } from 'rxjs';
import { StaffMember } from '../../models/staff-member.model';
import { SocketService } from './socket.service';
import { API_ENDPOINTS } from '../config/api.config';

// StaffService
@Injectable({
  providedIn: 'root'
})
export class StaffService {

  private readonly apiUrl = API_ENDPOINTS.staff;
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  private realtimeRefreshInProgress = false;

  private realtimeRefreshPending = false;

  // ----- All staff members observable/cache -----
  private staffSubject = new BehaviorSubject<StaffMember[]>([]);
  readonly staff$ = this.staffSubject.asObservable();

  // ----- Staff eligible for board assignment (year_level !== '4th_year') -----
  private eligibleSubject = new BehaviorSubject<StaffMember[]>([]);
  readonly eligibleForBoard$ = this.eligibleSubject.asObservable();

  constructor() {
    this.initializeRealtime();
  }

  private initializeRealtime(): void {
    this.socketService
      .onEditorialBoardUpdated(() => {
        console.log(
          '📡 Editorial board changed staff state'
        );

        this.refreshFromRealtime();
      });
  }

  private refreshFromRealtime(): void {
    if (
      this.realtimeRefreshInProgress
    ) {
      this.realtimeRefreshPending = true;
      return;
    }

    this.realtimeRefreshInProgress = true;

    forkJoin({
      staff: this.loadStaff(),
      eligible:
        this.loadEligibleForBoard(),
    })
      .pipe(
        finalize(() => {
          this.realtimeRefreshInProgress =
            false;

          if (
            this.realtimeRefreshPending
          ) {
            this.realtimeRefreshPending =
              false;

            this.refreshFromRealtime();
          }
        })
      )
      .subscribe({
        error: error => {
          console.error(
            'Failed to refresh staff after editorial-board update:',
            error
          );
        },
      });
  }

  // Parse date-like fields returned from API into proper Date objects
  private parseDates(member: any): StaffMember {
    return {
      ...member,
      createdAt: member.createdAt ? new Date(member.createdAt) : undefined,
    };
  }

  // ====================================
  // Data Loading
  // ====================================
  loadStaff(): Observable<StaffMember[]> {
    return this.http
      .get<any[]>(this.apiUrl)
      .pipe(
        map(members =>
          members.map(member =>
            this.parseDates(member)
          )
        ),
        tap(members => {
          this.staffSubject.next(members);
        })
      );
  }

  loadEligibleForBoard(): Observable<StaffMember[]> {
    return this.http
      .get<any[]>(
        `${this.apiUrl}/eligible-for-board`
      )
      .pipe(
        map(members =>
          members.map(member =>
            this.parseDates(member)
          )
        ),
        tap(members => {
          this.eligibleSubject.next(members);
        })
      );
  }

  refreshStaff(): Observable<StaffMember[]> {
    return this.loadStaff();
  }

  refreshEligibleForBoard(): Observable<StaffMember[]> {
    return this.loadEligibleForBoard();
  }

  getAll(): StaffMember[] {
    return this.staffSubject.value;
  }

  // ====================================
  // Create from Application
  // Persists to staff_members table and also marks the application as assigned.
  // ====================================
  createFromApplication(
    applicationId: string,
    section: string,
    role: string
  ): Observable<StaffMember> {
    return this.http
      .post<any>(`${this.apiUrl}/from-application/${applicationId}`, { section, role })
      .pipe(
        tap(member => {
          const parsed = this.parseDates(member);
          this.staffSubject.next([parsed, ...this.staffSubject.value]);
          if (parsed.yearLevel !== '4th_year') {
            this.eligibleSubject.next([parsed, ...this.eligibleSubject.value]);
          }
        })
      );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`).pipe(
      tap(() => {
        this.staffSubject.next(this.staffSubject.value.filter(m => m.id !== id));
        this.eligibleSubject.next(this.eligibleSubject.value.filter(m => m.id !== id));
      })
    );
  }

  update(
    id: string,
    patch: Omit<Partial<StaffMember>,
      | 'studentId'
      | 'yearLevel'
      | 'collegeId'
      | 'programId'
      | 'positionId'
      | 'subRole'
      | 'assignedSection'
      | 'assignedRole'
    > & {
      studentId?: string | null;
      yearLevel?: string | null;
      collegeId?: string | null;
      programId?: string | null;
      positionId?: string | null;
      subRole?: string | null;
      assignedSection?: string | null;
      assignedRole?: string | null;
    }
  ): Observable<StaffMember> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, patch).pipe(
      tap((member) => {
        const parsed = this.parseDates(member);

        const nextAll = this.staffSubject.value.map((m) => (m.id === id ? { ...m, ...parsed } : m));
        this.staffSubject.next(nextAll);

        const shouldBeEligible = parsed.yearLevel !== '4th_year';
        const currentlyEligible = this.eligibleSubject.value.some((m) => m.id === id);

        if (shouldBeEligible && !currentlyEligible) {
          this.eligibleSubject.next([parsed, ...this.eligibleSubject.value]);
        } else if (!shouldBeEligible && currentlyEligible) {
          this.eligibleSubject.next(this.eligibleSubject.value.filter((m) => m.id !== id));
        } else if (shouldBeEligible && currentlyEligible) {
          this.eligibleSubject.next(this.eligibleSubject.value.map((m) => (m.id === id ? { ...m, ...parsed } : m)));
        }
      })
    );
  }
}
