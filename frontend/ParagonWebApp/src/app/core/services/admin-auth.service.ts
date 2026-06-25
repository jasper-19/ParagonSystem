/*
  AdminAuthService
  - Purpose: client-side thin wrapper around admin authentication endpoints.
  - Rules: Formatting and comments only; do NOT change logic or behavior.
*/

import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map, tap } from "rxjs";
import { StaffMember } from "../../models/staff-member.model";

// Note: API endpoints are hardcoded here for clarity and to avoid circular imports with api.config.ts
import { API_ENDPOINTS } from "../config/api.config";

/**
 * DTO returned by the backend for an active session.
 * Kept identical to server shape; conversion happens in `getSessions()`.
 */
export interface ActiveSessionDto {
  id: string;
  browser: string;
  browserVersion: string;
  browserLabel: string;
  os: string;
  osLabel: string;
  device: string;
  userAgent?: string;
  lastActiveAt: string;
  current: boolean;
}

/**
 * Client-friendly session representation used by the UI.
 */
export interface ActiveSession {
  id: string;
  browser: string;
  os: string;
  device: string;
  lastActive: Date;
  current: boolean;
}

@Injectable({ providedIn: "root" })
export class AdminAuthService {
  // Key used to persist token in localStorage
  private readonly tokenKey = 'authToken';

  // Base API endpoint for auth-related requests
  private readonly  api = API_ENDPOINTS.auth;

  // Inject HttpClient using function-style injection to keep constructor-less service
  private http = inject(HttpClient);

  // ===== Authentication actions =====
  login(username: string, password: string): Observable<void> {
    // POST credentials and store returned token in localStorage
    return this.http
      .post<{ token: string }>(`${this.api}/login`, { username, password })
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
    return this.http.get<any>(`${this.api}/me`).pipe(
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
    return this.http.patch<void>(`${this.api}/password`, { currentPassword, newPassword });
  }

  setTwoFaEnabled(enabled: boolean): Observable<{ twoFaEnabled: boolean }> {
    return this.http.patch<{ twoFaEnabled: boolean }>(`${this.api}/2fa`, { enabled });
  }

  // ===== Session management =====
  getSessions(): Observable<ActiveSession[]> {
    // Convert backend DTOs into client-friendly ActiveSession objects
    return this.http.get<{ sessions: ActiveSessionDto[] }>(`${this.api}/sessions`).pipe(
      map((res) => {
        const list = res?.sessions ?? [];
        return list.map((s) => ({
          id: s.id,
          browser: s.browserLabel,
          os: s.osLabel,
          device: s.device,
          lastActive: new Date(s.lastActiveAt),
          current: s.current,
        }));
      })
    );
  }

  logoutSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/sessions/${sessionId}`);
  }
}
