import { Injectable } from '@angular/core';
import { io, Socket } from 'socket.io-client';

import { SOCKET_EVENTS } from '../constants/socket-events';

@Injectable({
  providedIn: 'root',
})
export class SocketService {

  private socket?: Socket;

  connect(): void {

    if (this.socket?.connected) {
      return;
    }

    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🟢 Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected');
    });

  }

  disconnect(): void {
    this.socket?.disconnect();
  }

  on<T>(event: string, callback: (payload: T) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string): void {
    this.socket?.off(event);
  }

  emit(event: string, payload?: unknown): void {
    this.socket?.emit(event, payload);
  }

  onArticlesUpdated(callback: () => void): void {
    this.connect();
    this.on(SOCKET_EVENTS.ARTICLES_UPDATED, callback);
  }

}
