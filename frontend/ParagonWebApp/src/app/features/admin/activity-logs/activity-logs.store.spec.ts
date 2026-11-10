import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ActivityLogsService, PaginatedActivityLogs } from '../../../core/services/activity-logs.service';
import { SocketService } from '../../../core/services/socket.service';
import { ActivityLog } from '../../../models/activity-log.model';
import { ActivityLogsStore } from './activity-logs.store';

describe('Activity log state and requests', () => {
  const log: ActivityLog = { id: 'sample-log', userId: 'sample-admin', userName: 'Sample Editor', action: 'UPDATE', module: 'ARTICLES', description: 'Updated a synthetic article.', entityId: 'sample-article', entityType: 'ARTICLES', ipAddress: '192.0.2.1', createdAt: '2026-11-10T00:00:00Z' };
  const response: PaginatedActivityLogs = { items: [log], page: 1, limit: 10, total: 100, totalPages: 10 };
  let store: ActivityLogsStore;
  let service: { getLogs: ReturnType<typeof vi.fn>; getFilterOptions: ReturnType<typeof vi.fn> };
  let update: () => void;
  let removeListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    removeListener = vi.fn();
    service = { getLogs: vi.fn((filters: { page: number; limit: number }) => of({ ...response, page: filters.page, limit: filters.limit })), getFilterOptions: vi.fn(() => of({ modules: ['ARTICLES'], actions: ['UPDATE'] })) };
    TestBed.configureTestingModule({ providers: [ActivityLogsStore,
      { provide: ActivityLogsService, useValue: service },
      { provide: SocketService, useValue: { onActivityLogsUpdated: (callback: () => void) => { update = callback; return removeListener; } } },
    ] });
    store = TestBed.inject(ActivityLogsStore);
    store.initialize();
  });
  afterEach(() => { TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('normalizes filters and retains them when changing page size', () => {
    store.currentPage.set(4);
    store.setFilters({ module: ' ARTICLES ', action: ' UPDATE ', dateFrom: ' 2026-11-10 ', search: ' sample ' });
    expect(service.getLogs).toHaveBeenLastCalledWith({ module: 'ARTICLES', action: 'UPDATE', dateFrom: '2026-11-10', search: 'sample', page: 1, limit: 10 });
    store.setPageSize('25');
    expect(service.getLogs).toHaveBeenLastCalledWith({ module: 'ARTICLES', action: 'UPDATE', dateFrom: '2026-11-10', search: 'sample', page: 1, limit: 25 });
    store.setFilters({});
    expect(service.getLogs).toHaveBeenLastCalledWith({ module: undefined, action: undefined, dateFrom: undefined, search: undefined, page: 1, limit: 25 });
  });

  it('clamps paging and rejects paging or size changes during a pending request', () => {
    const pending = new Subject<PaginatedActivityLogs>(); service.getLogs.mockReturnValue(pending);
    store.goToPage(99);
    expect(service.getLogs).toHaveBeenLastCalledWith({ page: 10, limit: 10 });
    expect(store.isLoading()).toBe(true);
    const count = service.getLogs.mock.calls.length;
    store.goToPage(2); store.setPageSize(25); store.setPageSize(17);
    expect(service.getLogs).toHaveBeenCalledTimes(count);
    pending.next({ ...response, page: 10 }); pending.complete();
    store.goToPage(-2);
    expect(service.getLogs).toHaveBeenLastCalledWith({ page: 1, limit: 10 });
  });

  it('debounces realtime reloads and updates or clears the selected detail record', async () => {
    vi.useFakeTimers(); store.selectLog(log);
    const updated = { ...log, description: 'Updated synthetic description.' };
    service.getLogs.mockReturnValue(of({ ...response, items: [updated] }));
    update(); update(); await vi.advanceTimersByTimeAsync(249);
    expect(service.getLogs).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1);
    expect(service.getLogs).toHaveBeenCalledTimes(2); expect(store.selectedLog()).toEqual(updated);
    service.getLogs.mockReturnValue(of({ ...response, items: [], total: 0, totalPages: 0 }));
    store.refresh();
    expect(store.selectedLog()).toBeNull(); expect(store.rangeStart()).toBe(0); expect(store.rangeEnd()).toBe(0); expect(store.totalPages()).toBe(1);
    TestBed.resetTestingModule(); expect(removeListener).toHaveBeenCalledOnce();
  });

  it('keeps existing rows on failure and supports an explicit retry', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const pending = new Subject<PaginatedActivityLogs>(); service.getLogs.mockReturnValue(pending);
    store.refresh(); pending.error(new Error('Synthetic unavailable response'));
    expect(store.status()).toBe('error'); expect(store.logs()).toEqual([log]); expect(store.errorMessage()).toContain('Please try again');
    service.getLogs.mockReturnValue(of(response)); store.refresh();
    expect(store.status()).toBe('loaded'); expect(store.errorMessage()).toBe('');
  });
});
