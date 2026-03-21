import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, map, tap } from "rxjs";
import { StaffMember } from "../../models/staff-member.model";

export interface ActiveSessionDto {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string | Date;
  lastActiveAt: string | Date;
  revokedAt: string | Date | null;
  current: boolean;
}

export interface ActiveSession {
  id: string;
  device: string;
  lastActive: Date;
  current: boolean;
}

@Injectable({ providedIn: "root"})
export class AdminAuthService {
  private readonly tokenKey = 'authToken';
  private http = inject(HttpClient);

  login(username: string, password: string): Observable<void> {
    return this.http
      .post<{ token: string }>('/api/auth/login', { username, password })
      .pipe(
        tap(res => localStorage.setItem(this.tokenKey, res.token))
      ) as unknown as Observable<void>;
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  isAdminSession(): boolean {
    return !!this.getToken();
  }

  me(): Observable<{ user: any; staff: StaffMember | null }> {
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

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.patch<void>('/api/auth/password', { currentPassword, newPassword });
  }

  setTwoFaEnabled(enabled: boolean): Observable<{ twoFaEnabled: boolean }> {
    return this.http.patch<{ twoFaEnabled: boolean }>('/api/auth/2fa', { enabled });
  }

  getSessions(): Observable<ActiveSession[]> {
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
