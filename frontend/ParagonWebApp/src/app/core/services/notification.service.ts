import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AdminAuthService } from './admin-auth.service';

// =====================================================
// Notification service
// - Loads existing notifications from the API
// - Connects to a server-sent events (SSE) stream to receive live notifications
// - Exposes `notifications` as a signal for consumers
// - Provides a helper to mark all notifications as read
// =====================================================

export interface NotificationItem {
  id: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService implements OnDestroy {
  // ----- Injected dependencies -----
  private http = inject(HttpClient);
  private auth = inject(AdminAuthService);

  // ----- Public state (signal) exposed to consumers -----
  readonly notifications = signal<NotificationItem[]>([]);

  // ----- Internal SSE connection object -----
  private eventSource?: EventSource;

  constructor() {
    // Load initial notification list and establish SSE connection
    this.load();
    this.connectSSE();
  }

  // =====================================================
  // Data loading
  // - Fetch current notifications from backend API
  // =====================================================
  private load(): void {
    this.http.get<NotificationItem[]>('/api/notifications').subscribe({
      next: items => this.notifications.set(items),
      error: () => {},
    });
  }

  // =====================================================
  // Server-Sent Events (SSE) connection
  // - Uses AdminAuthService token for authentication via query param
  // - Prepends new notifications to the in-memory list
  // - Implements basic reconnect logic on error when closed
  // =====================================================
  private connectSSE(): void {
    const token = this.auth.getToken();
    if (!token) return;

    this.eventSource = new EventSource(`/api/notifications/stream?token=${encodeURIComponent(token)}`);

    // Handle incoming message frames
    this.eventSource.onmessage = (event: MessageEvent) => {
      try {
        const notification = JSON.parse(event.data as string) as NotificationItem;
        this.notifications.update(list => [notification, ...list]);
      } catch {
        // ignore malformed frames
      }
    };

    // Handle connection errors and attempt reconnect when fully closed
    this.eventSource.onerror = () => {
      // readyState CONNECTING (0) means the browser is already auto-reconnecting — do nothing.
      // Only intervene when the connection is fully CLOSED (2).
      if (this.eventSource?.readyState !== EventSource.CLOSED) return;

      this.eventSource.close();
      this.eventSource = undefined;

      // Wait a moment before attempting to reconnect
      setTimeout(() => this.connectSSE(), 5_000);
    };
  }

  // =====================================================
  // Actions
  // - markAllRead: mark notifications read server-side and clear local list
  // =====================================================
  markAllRead(): void {
    this.http.patch('/api/notifications/read-all', {}).subscribe({
      next: () => this.notifications.set([]),
      error: () => {},
    });
  }

  // Clean up SSE connection when service is destroyed
  ngOnDestroy(): void {
    this.eventSource?.close();
  }
}
