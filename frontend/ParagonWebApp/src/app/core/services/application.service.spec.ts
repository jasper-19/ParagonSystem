import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { API_ENDPOINTS } from '../config/api.config';
import { ApplicationService } from './application.service';
import { SocketService } from './socket.service';

describe('Application query filter persistence', () => {
  let service: ApplicationService;
  let http: HttpTestingController;
  let applicationsUpdated: () => void;
  let boardUpdated: () => void;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: SocketService, useValue: {
        onApplicationsUpdated: (callback: () => void) => { applicationsUpdated = callback; },
        onEditorialBoardUpdated: (callback: () => void) => { boardUpdated = callback; },
        onApplicationSettingsUpdated: vi.fn(),
      } },
    ] });
    service = TestBed.inject(ApplicationService);
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  function request(): TestRequest {
    return http.expectOne(req => req.url === API_ENDPOINTS.applications && req.method === 'GET');
  }
  function finish(req: TestRequest): void {
    req.flush({ items: [], page: Number(req.request.params.get('page')), limit: Number(req.request.params.get('limit')), total: 0, totalPages: 1 });
  }

  it('clears search and status when callers explicitly pass undefined', () => {
    service.refresh(1, 10, 'pending', 'sample'); finish(request());
    service.refresh(1, 10, 'pending', undefined);
    const clearedSearch = request();
    expect(clearedSearch.request.params.get('status')).toBe('pending');
    expect(clearedSearch.request.params.has('search')).toBe(false);
    finish(clearedSearch);
    service.refresh(1, 10, undefined, 'sample');
    const allStatuses = request();
    expect(allStatuses.request.params.has('status')).toBe(false);
    expect(allStatuses.request.params.get('search')).toBe('sample');
    finish(allStatuses);
    service.refresh(1, 10, undefined, undefined);
    const unfiltered = request();
    expect(unfiltered.request.params.has('status')).toBe(false);
    expect(unfiltered.request.params.has('search')).toBe(false);
    finish(unfiltered);
  });

  it('retains the latest filters for omitted arguments and realtime refreshes, including cleared filters', () => {
    service.refresh(2, 20, 'interview_scheduled', 'sample'); finish(request());
    applicationsUpdated();
    const realtime = request();
    expect(realtime.request.params.get('page')).toBe('2');
    expect(realtime.request.params.get('limit')).toBe('20');
    expect(realtime.request.params.get('status')).toBe('interview_scheduled');
    expect(realtime.request.params.get('search')).toBe('sample'); finish(realtime);
    service.refresh(3, 20);
    const paged = request();
    expect(paged.request.params.get('status')).toBe('interview_scheduled');
    expect(paged.request.params.get('search')).toBe('sample'); finish(paged);
    service.refresh(1, 20, undefined, undefined); finish(request());
    boardUpdated();
    const clearedRealtime = request();
    expect(clearedRealtime.request.params.has('status')).toBe(false);
    expect(clearedRealtime.request.params.has('search')).toBe(false); finish(clearedRealtime);
  });

  it('uses cleared filters for a queued refresh after an older filtered request completes', () => {
    service.refresh(1, 10, 'pending', 'sample');
    const old = request();
    service.refresh(1, 10, undefined, undefined);
    http.expectNone(req => req.url === API_ENDPOINTS.applications);
    finish(old);
    const latest = request();
    expect(latest.request.params.has('status')).toBe(false);
    expect(latest.request.params.has('search')).toBe(false);
    finish(latest);
  });
});
