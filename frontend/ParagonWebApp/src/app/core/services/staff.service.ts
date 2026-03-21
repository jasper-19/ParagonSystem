import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { StaffMember } from '../../models/staff-member.model';

@Injectable({
  providedIn: 'root'
})
export class StaffService {

  private readonly apiUrl = '/api/staff';
  private http = inject(HttpClient);

  private staffSubject = new BehaviorSubject<StaffMember[]>([]);
  readonly staff$ = this.staffSubject.asObservable();

  /** Staff members eligible for board assignment (year_level !== '4th_year'). */
  private eligibleSubject = new BehaviorSubject<StaffMember[]>([]);
  readonly eligibleForBoard$ = this.eligibleSubject.asObservable();

  constructor() {
    this.loadStaff();
    this.loadEligibleForBoard();
  }

  private parseDates(member: any): StaffMember {
    return {
      ...member,
      createdAt: member.createdAt ? new Date(member.createdAt) : undefined,
    };
  }

  // ====================================
  // Data Loading
  // ====================================

  private loadStaff(): void {
    this.http.get<any[]>(this.apiUrl).subscribe({
      next: members => this.staffSubject.next(members.map(m => this.parseDates(m))),
      error: err => console.error('Failed to load staff:', err)
    });
  }

  private loadEligibleForBoard(): void {
    this.http.get<any[]>(`${this.apiUrl}/eligible-for-board`).subscribe({
      next: members => this.eligibleSubject.next(members.map(m => this.parseDates(m))),
      error: err => console.error('Failed to load eligible staff:', err)
    });
  }

  refresh(): void {
    this.loadStaff();
    this.loadEligibleForBoard();
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
