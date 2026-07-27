import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

import { SOCKET_EVENTS } from '../constants/socket-events';
import { environment } from '../../../environments/environment';

export interface ArticlesUpdatedPayload {
  articleId?: string;
  previousSlug?: string;
  currentSlug?: string;
}

export interface ActivityLogsUpdatedPayload {
  activityLogId?: string;
  action?: string;
  module?: string;
}

export interface GlobalSettingsUpdatedPayload {
  section: 'general' | 'publishingMedia' | 'notifications' | 'maintenance';
  version: number;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class SocketService {

  private socket?: Socket;

  connect(): void {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.connect();
      }

      return;
    }

    const socketUrl = environment.apiUrl.replace(/\/api\/?$/, '');

    this.socket = io(
      socketUrl,
      {
        transports: ['websocket'],
        withCredentials: true,
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
      }
    );

    this.socket.on('connect', () => {
      console.log('🟢 Socket connected');
    });

    this.socket.on(
      'disconnect',
      reason => {
        console.log(
          '🔴 Socket disconnected:',
          reason
        );
      }
    );

    this.socket.on(
      'connect_error',
      error => {
        console.error(
          'Socket connection failed:',
          error
        );
      }
    );
  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  reconnectWithCurrentSession(): void {
    if (!this.socket) {
      this.connect();
      return;
    }

    this.socket.disconnect();
    this.socket.connect();
  }

  on<T>(
    event: string,
    callback: (payload: T) => void
  ): () => void {
    this.socket?.on(event, callback);

    return () => {
      this.socket?.off(event, callback);
    };
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    if (callback) {
      this.socket?.off(event, callback);
      return;
    }

  this.socket?.off(event);
}

  emit(event: string, payload?: unknown): void {
    this.socket?.emit(event, payload);
  }

  onArticlesUpdated(
    callback: (
      payload: ArticlesUpdatedPayload
    ) => void
  ): void {
    this.connect();

    this.on<ArticlesUpdatedPayload>(
      SOCKET_EVENTS.ARTICLES_UPDATED,
      callback
    );
  }

  onApplicationsUpdated(
    callback: () => void
  ): () => void {
    this.connect();

    return this.on<void>(
      SOCKET_EVENTS.APPLICATIONS_UPDATED,
      callback
    );
  }

  onMediaUpdated(
    callback: () => void
  ): () => void {
    this.connect();

    return this.on<void>(
      SOCKET_EVENTS.MEDIA_UPDATED,
      callback
    );
  }

  onApplicationSettingsUpdated(
    callback: () => void
  ): () => void {
    this.connect();

    return this.on<void>(
      SOCKET_EVENTS.APPLICATION_SETTINGS_UPDATED,
      callback
    );
  }

  onEditorialBoardUpdated(
    callback: () => void
  ): () => void {
    this.connect();

    return this.on<void>(
      SOCKET_EVENTS.EDITORIAL_BOARD_UPDATED,
      callback
    );
  }

  onActivityLogsUpdated(
    callback: (
      payload:
        ActivityLogsUpdatedPayload
    ) => void
  ): () => void {
    this.connect();

    return this.on<
      ActivityLogsUpdatedPayload
    >(
      SOCKET_EVENTS
        .ACTIVITY_LOGS_UPDATED,
      callback
    );
  }

  onGlobalSettingsUpdated(
    callback: (payload: GlobalSettingsUpdatedPayload) => void
  ): () => void {
    this.connect();
    return this.on<GlobalSettingsUpdatedPayload>(
      SOCKET_EVENTS.GLOBAL_SETTINGS_UPDATED,
      callback
    );
  }

  onUserAccountsUpdated(callback: () => void): () => void {
    this.connect();
    return this.on<void>(SOCKET_EVENTS.USER_ACCOUNTS_UPDATED, callback);
  }

}
