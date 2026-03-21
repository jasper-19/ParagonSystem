import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AdminAuthService } from './admin-auth.service';

export interface NotificationItem {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  readonly notifications = signal<NotificationItem[]>([]);

  private eventSource?: EventSource;

  constructor() {
    this.load();
    this.connectSSE();
  }

  private load(): void {
    this.http.get<NotificationItem[]>('/api/notifications').subscribe({
      next: items => this.notifications.set(items),
      error: () => {},
    });
  }

  private connectSSE(): void {
    const token = this.auth.getToken();
    if (!token) return;

    this.eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const notification = JSON.parse(event.data as string) as NotificationItem;
        this.notifications.update(list => [notification, ...list]);
      } catch { /* ignore malformed frames */ }
    };

    this.eventSource.onerror = () => {
      // readyState CONNECTING (0) means the browser is already auto-reconnecting — do nothing.
      // Only intervene when the connection is fully CLOSED (2).
      if (this.eventSource?.readyState !== EventSource.CLOSED) return;
      this.eventSource.close();
      this.eventSource = undefined;
      setTimeout(() => this.connectSSE(), 5_000);
    };
  }

  markAllRead(): void {
    this.http.patch('/api/notifications/read-all', {}).subscribe({
      next: () => this.notifications.set([]),
      error: () => {},
    });
  }

  ngOnDestroy(): void {
    this.eventSource?.close();
  }
}
