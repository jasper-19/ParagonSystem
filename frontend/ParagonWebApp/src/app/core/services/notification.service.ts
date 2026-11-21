import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { EMPTY, Subject, Subscription, auditTime, catchError, defer, finalize, switchMap } from 'rxjs';
import { API_ENDPOINTS } from '../config/api.config';

export interface NotificationItem {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const MAX_NOTIFICATIONS = 50;

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = API_ENDPOINTS.notifications;
  private readonly refreshRequests = new Subject<void>();
  private readonly refreshSubscription: Subscription;
  private readSubscription?: Subscription;
  private eventSource?: EventSource;
  private streamInvalidation?: EventListener;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retryDelay = 1_000;
  private active = true;
  private readonly onFocus = () => this.refresh();
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') this.refresh();
  };

  readonly notifications = signal<NotificationItem[]>([]);
  readonly loading = signal(true);
  readonly markingRead = signal(false);
  readonly error = signal('');
  readonly sessionExpired = signal(false);

  constructor() {
    this.refreshSubscription = this.refreshRequests.pipe(
      // Coalesce bursts while allowing periodic refreshes during sustained activity.
      auditTime(100),
      switchMap(() => defer(() => {
        this.loading.set(true);
        return this.http.get<unknown>(this.apiUrl).pipe(
          catchError(error => {
            this.handleError(error);
            return EMPTY;
          }),
          finalize(() => this.loading.set(false)),
        );
      })),
    ).subscribe(items => {
      if (!this.active) return;
      this.notifications.set(this.normalize(items));
      this.error.set('');
    });
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      window.addEventListener('focus', this.onFocus);
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.refresh();
      this.connectSSE();
    } else this.loading.set(false);
  }

  refresh(): void {
    if (this.active) this.refreshRequests.next();
  }

  private connectSSE(): void {
    if (!this.active || this.eventSource || typeof EventSource === 'undefined') return;
    let source: EventSource;
    try {
      source = this.eventSource = new EventSource(`${this.apiUrl}/stream`, { withCredentials: true });
    } catch {
      this.scheduleReconnect();
      return;
    }
    const refresh = () => { if (this.active && this.eventSource === source) this.refresh(); };
    this.streamInvalidation = refresh;
    source.addEventListener('notifications:updated', refresh);
    // Treat old server frames as invalidations during rolling upgrades, never trust their payload.
    source.onmessage = refresh;
    source.onopen = () => {
      if (this.eventSource !== source) return;
      this.retryDelay = 1_000;
      this.refresh(); // Recover missed events before every reconnection.
    };
    source.onerror = () => {
      if (this.eventSource !== source || !this.active) return;
      this.refresh(); // EventSource hides HTTP status; probe the authenticated API for expiry.
      if (source.readyState !== EventSource.CLOSED) return;
      this.closeStream();
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (!this.active || this.retryTimer) return;
    const delay = this.retryDelay;
    this.retryDelay = Math.min(this.retryDelay * 2, 30_000);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.connectSSE();
    }, delay);
  }

  markAllRead(): void {
    if (!this.active || this.markingRead()) return;
    this.markingRead.set(true);
    this.readSubscription = this.http.patch(`${this.apiUrl}/read-all`, {}).pipe(
      finalize(() => this.markingRead.set(false)),
    ).subscribe({
      // Refetch instead of clearing: another notification may arrive during the save.
      next: () => this.refresh(),
      error: error => this.handleError(error),
    });
  }

  private handleError(error: { status?: number } | null): void {
    if (!this.active) return;
    if (error?.status === 401 || error?.status === 403) {
      this.sessionExpired.set(true);
      this.error.set('Your session has expired. Please sign in again.');
      this.stop();
      return;
    }
    this.error.set('Notifications could not be updated. Try again.');
  }

  private normalize(value: unknown): NotificationItem[] {
    if (!Array.isArray(value)) return [];
    const items = new Map<string, NotificationItem>();
    for (const raw of value.slice(0, 500)) {
      if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id || raw.id.length > 128 ||
          typeof raw.message !== 'string' || !raw.message.trim() || typeof raw.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(raw.createdAt)) || raw.isRead !== false || items.has(raw.id)) continue;
      items.set(raw.id, {
        id: raw.id,
        message: raw.message.slice(0, 500),
        type: typeof raw.type === 'string' ? raw.type.slice(0, 30) : 'info',
        isRead: false,
        createdAt: raw.createdAt,
      });
    }
    return [...items.values()].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)).slice(0, MAX_NOTIFICATIONS);
  }

  private closeStream(): void {
    if (!this.eventSource) return;
    if (this.streamInvalidation) this.eventSource.removeEventListener('notifications:updated', this.streamInvalidation);
    this.streamInvalidation = undefined;
    this.eventSource.onopen = this.eventSource.onmessage = this.eventSource.onerror = null;
    this.eventSource.close();
    this.eventSource = undefined;
  }

  private stop(): void {
    this.active = false;
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.onFocus);
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.closeStream();
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = undefined;
    this.refreshSubscription.unsubscribe();
    this.readSubscription?.unsubscribe();
    this.notifications.set([]);
    this.loading.set(false);
    this.markingRead.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
    this.refreshRequests.complete();
  }
}
