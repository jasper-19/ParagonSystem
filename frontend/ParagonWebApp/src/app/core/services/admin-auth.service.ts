import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map, tap, catchError, shareReplay, throwError } from "rxjs";
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

export interface AdminMeResponse {
  user: {
    id?: string;
    username?: string;
    role?: string;
    twoFaEnabled?: boolean;
    [key: string]: unknown;
  } | null;

  staff: StaffMember | null;
}

@Injectable({ providedIn: "root" })
export class AdminAuthService {
  constructor() {
    localStorage.removeItem("authToken");
  }

  // Base API endpoint for auth-related requests
  private readonly  api = API_ENDPOINTS.auth;

  // Inject HttpClient using function-style injection to keep constructor-less service
  private http = inject(HttpClient);

  // Optional cached observable for the current user/staff info; used to avoid duplicate requests
  private meRequest$: Observable<AdminMeResponse> | null = null;

  // Helper to map the backend response to the AdminMeResponse shape
  private mapMeResponse( response: any ): AdminMeResponse {
    const staff = response?.staff ? ({...response.staff,
            createdAt: response.staff.createdAt
                ? new Date(
                    response.staff.createdAt
                  )
                : undefined,
          } as StaffMember)
        : null;

    return { user: response?.user ?? null, staff,};
  }

  // ===== Authentication actions =====
  login(
    username: string,
    password: string
  ): Observable<void> {
    return this.http
      .post<{ ok: boolean }>(
        `${this.api}/login`,
        {
          username,
          password,
        }
      )
      .pipe(
        tap(() => {
          this.meRequest$ = null;
        }),

        map(() => undefined)
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.api}/logout`, {})
      .pipe(
        tap(() => {
          this.meRequest$ = null;
        })
      );
  }

  // ===== User / staff info =====
me(
  forceRefresh = false
): Observable<AdminMeResponse> {
  if (
    forceRefresh ||
    !this.meRequest$
  ) {
    this.meRequest$ =
      this.http
        .get<any>(
          `${this.api}/me`
        )
        .pipe(
          map(response =>
            this.mapMeResponse(
              response
            )
          ),

          catchError(error => {
            this.meRequest$ = null;

            return throwError(
              () => error
            );
          }),

          shareReplay({
            bufferSize: 1,
            refCount: false,
          })
        );
  }

  return this.meRequest$;
}

  // Convenience method to force a refresh of the current user/staff info
  refreshMe():
    Observable<AdminMeResponse> {
    return this.me(true);
  }

  //  Invalidate the cached me() observable so that the next call will fetch fresh data from the backend
  invalidateMeCache(): void {
    this.meRequest$ = null;
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
          browser: s.browserLabel ?? s.browser ?? 'Unknown Browser',
          os: s.osLabel ?? s.os ?? 'Unknown OS',
          device: s.device ?? 'Desktop',
          lastActive: s.lastActiveAt ? new Date(s.lastActiveAt) : new Date(),
          current: !!s.current,
        }));
      })
    );
  }

  logoutSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/sessions/${sessionId}`);
  }
}
