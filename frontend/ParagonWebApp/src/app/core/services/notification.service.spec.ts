import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationService } from './notification.service';
import { API_ENDPOINTS } from '../config/api.config';
import { AdminAuthService } from './admin-auth.service';
import { AdminHeaderComponent } from '../../features/admin/layout/admin-header/admin-header';

class FakeEventSource extends EventTarget {
  static CLOSED = 2;
  static instances: FakeEventSource[] = [];
  readyState = 1;
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn(() => { this.readyState = 2; });
  constructor(readonly url: string, readonly options: EventSourceInit) {
    super(); FakeEventSource.instances.push(this);
  }
}
const api = API_ENDPOINTS.notifications;
const item = (id: string, extra = {}) => ({ id, message: `Notification ${id}`, type: 'info', isRead: false,
  createdAt: '2026-11-21T00:00:00.000Z', ...extra });

describe('NotificationService', () => {
  let service: NotificationService;
  let http: HttpTestingController;
  const tick = () => vi.advanceTimersByTime(100);
  const source = () => FakeEventSource.instances.at(-1)!;
  beforeEach(() => {
    vi.useFakeTimers();
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
    TestBed.configureTestingModule({ imports: [AdminHeaderComponent], providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AdminAuthService, useValue: { me: () => of({ user: { username: 'Admin', role: 'admin' } }) } },
    ] });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(NotificationService);
  });
  afterEach(() => {
    service.ngOnDestroy();
    http.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
    vi.useRealTimers(); vi.unstubAllGlobals();
  });

  it('deduplicates, bounds and validates snapshots without trusting streamed data', () => {
    source().onmessage!(new MessageEvent('message', { data: '{not-json' }));
    tick();
    const many = Array.from({ length: 65 }, (_, i) => item(String(i)));
    http.expectOne(api).flush([null, item('bad', { createdAt: 'invalid' }), item('read', { isRead: true }), many[0], ...many]);
    expect(service.notifications()).toHaveLength(50);
    expect(new Set(service.notifications().map(n => n.id)).size).toBe(50);
    expect(service.notifications().some(n => ['bad', 'read'].includes(n.id))).toBe(false);
  });

  it('coalesces bursts and reloads after reconnect and focus', () => {
    tick(); http.expectOne(api).flush([item('old')]);
    for (let i = 0; i < 25; i++) source().dispatchEvent(new Event('notifications:updated'));
    source().onopen!(); window.dispatchEvent(new Event('focus'));
    tick(); http.expectOne(api).flush([item('new')]);
    expect(service.notifications()[0].id).toBe('new');
    source().onopen!(); tick(); http.expectOne(api).flush([]);
    expect(service.notifications()).toEqual([]);
  });

  it('cancels older snapshots and refetches after marking read so concurrent notices survive', () => {
    tick(); http.expectOne(api).flush([item('old')]);
    service.refresh(); tick(); const oldSnapshot = http.expectOne(api);
    service.markAllRead(); service.markAllRead();
    http.expectOne(`${api}/read-all`).flush(null);
    tick(); expect(oldSnapshot.cancelled).toBe(true);
    http.expectOne(api).flush([item('new')]);
    expect(service.notifications().map(n => n.id)).toEqual(['new']);
    expect(service.markingRead()).toBe(false);
  });

  it('preserves details on transient errors and exposes recovery', () => {
    tick(); http.expectOne(api).flush([item('old')]);
    service.markAllRead(); http.expectOne(`${api}/read-all`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.error()).toContain('Try again');
    expect(service.notifications()).toHaveLength(1);
    service.refresh(); tick(); http.expectOne(api).flush([]);
    expect(service.error()).toBe('');
  });

  it('clears private state and cancels retries after an expired-session probe', () => {
    tick(); http.expectOne(api).flush([item('private')]);
    const stream = source(); stream.readyState = 2; stream.onerror!();
    tick(); http.expectOne(api).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.notifications()).toEqual([]);
    expect(service.sessionExpired()).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(FakeEventSource.instances).toHaveLength(1);
    service.refresh(); tick(); http.expectNone(api);
  });

  it('cancels pending requests, listeners and timers when destroyed', () => {
    tick(); const pending = http.expectOne(api);
    const stream = source(); stream.readyState = 2; stream.onerror!();
    service.ngOnDestroy();
    expect(pending.cancelled).toBe(true);
    expect(stream.close).toHaveBeenCalled();
    window.dispatchEvent(new Event('focus'));
    stream.dispatchEvent(new Event('notifications:updated'));
    vi.advanceTimersByTime(60_000);
    http.expectNone(api);
    expect(FakeEventSource.instances).toHaveLength(1);
  });

  it('scopes the header stream to its view and starts clean on reentry', () => {
    service.ngOnDestroy();
    const first = TestBed.createComponent(AdminHeaderComponent);
    tick(); http.expectOne(api).flush([item('old-session')]);
    const previous = source(); first.destroy();
    expect(previous.close).toHaveBeenCalled();
    const second = TestBed.createComponent(AdminHeaderComponent);
    expect(second.componentInstance.notifications()).toEqual([]);
    tick(); http.expectOne(api).flush([]);
    second.destroy();
  });

  it('loads via HTTP when EventSource is unavailable', () => {
    service.ngOnDestroy(); vi.stubGlobal('EventSource', undefined);
    const next = TestBed.createComponent(AdminHeaderComponent);
    tick(); http.expectOne(api).flush([item('fallback')]);
    expect(next.componentInstance.notifications()[0].id).toBe('fallback');
    next.destroy();
  });
});
