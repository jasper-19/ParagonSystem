/*
  AdminAuthService
  - Purpose: client-side thin wrapper around admin authentication endpoints.
  - Rules: Formatting and comments only; do NOT change logic or behavior.
*/

import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map, tap } from "rxjs";
import { StaffMember } from "../../models/staff-member.model";

/**
 * DTO returned by the backend for an active session.
 * Kept identical to server shape; conversion happens in `getSessions()`.
 */
export interface ActiveSessionDto {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string | Date;
  lastActiveAt: string | Date;
  revokedAt: string | Date | null;
  current: boolean;
}

/**
 * Client-friendly session representation used by the UI.
 */
export interface ActiveSession {
  id: string;
  device: string;
  lastActive: Date;
  current: boolean;
}

@Injectable({ providedIn: "root" })
export class AdminAuthService {
  // Key used to persist token in localStorage
  private readonly tokenKey = 'authToken';

  // Inject HttpClient using function-style injection to keep constructor-less service
  private http = inject(HttpClient);

  // ===== Authentication actions =====
  login(username: string, password: string): Observable<void> {
    // POST credentials and store returned token in localStorage
    return this.http
      .post<{ token: string }>('/api/auth/login', { username, password })
      .pipe(
        tap(res => localStorage.setItem(this.tokenKey, res.token))
      ) as unknown as Observable<void>;
  }

  logout(): void {
    // Remove persisted token to end the local session
    localStorage.removeItem(this.tokenKey);
  }

  // ===== Helpers & checks =====
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAdminSession(): boolean {
    // Simple presence check for token
    return !!this.getToken();
  }

  // ===== User / staff info =====
  me(): Observable<{ user: any; staff: StaffMember | null }> {
    // Fetch current user; convert staff.createdAt to Date when present
    return this.http.get<any>('/api/auth/me').pipe(
      map((res) => {
        const staff = res?.staff
          ? ({
              ...res.staff,
              createdAt: res.staff.createdAt ? new Date(res.staff.createdAt) : undefined,
            } as StaffMember)
          : null;
        return { user: res?.user, staff };
      })
    );
  }

  // ===== Account management =====
  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>('/api/auth/password', { currentPassword, newPassword });
  }

  setTwoFaEnabled(enabled: boolean): Observable<{ twoFaEnabled: boolean }> {
    return this.http.patch<{ twoFaEnabled: boolean }>('/api/auth/2fa', { enabled });
  }

  // ===== Session management =====
  getSessions(): Observable<ActiveSession[]> {
    // Convert backend DTOs into client-friendly ActiveSession objects
    return this.http.get<{ sessions: ActiveSessionDto[] }>('/api/auth/sessions').pipe(
      map((res) => {
        const list = res?.sessions ?? [];
        return list.map((s) => ({
          id: s.id,
          device: s.userAgent || 'Unknown device',
          lastActive: s.lastActiveAt ? new Date(s.lastActiveAt) : new Date(),
          current: !!s.current,
        }));
      })
    );
  }

  logoutSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`/api/auth/sessions/${sessionId}`);
  }
}
