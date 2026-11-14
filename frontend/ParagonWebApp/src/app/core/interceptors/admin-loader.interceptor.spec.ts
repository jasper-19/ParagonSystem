import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpContext, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { API_ENDPOINTS } from '../config/api.config';
import { SKIP_ADMIN_LOADER } from '../config/http-context';
import { AdminLoaderService } from '../services/admin-loader.service';
import { adminLoaderInterceptor } from './admin-loader.interceptor';

describe('Admin request loader scope and cleanup', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  const router = { url: '/admin/articles' };
  const begin = vi.fn();
  const end = vi.fn();

  beforeEach(() => {
    router.url = '/admin/articles';
    begin.mockReset().mockReturnValue(42);
    end.mockReset();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([adminLoaderInterceptor])),
      provideHttpClientTesting(),
      { provide: Router, useValue: router },
      { provide: AdminLoaderService, useValue: { begin, end } },
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    requests.verify({ ignoreCancelled: true });
    TestBed.resetTestingModule();
  });

  it('tracks both relative and configured API requests using each operation token', () => {
    for (const url of ['/api/articles', `${API_ENDPOINTS.base}/special-issues/admin`]) {
      http.get(url).subscribe();
      expect(begin).toHaveBeenCalled();
      requests.expectOne(url).flush([]);
      expect(end).toHaveBeenLastCalledWith(42);
    }
    expect(begin).toHaveBeenCalledTimes(2);
    expect(end).toHaveBeenCalledTimes(2);
  });

  it('does not track public routes, external assets, or a lookalike API prefix', () => {
    router.url = '/articles';
    http.get(`${API_ENDPOINTS.base}/articles`).subscribe();
    requests.expectOne(`${API_ENDPOINTS.base}/articles`).flush([]);
    router.url = '/admin/media';
    for (const url of ['/assets/cover.png', 'https://example.test/api/media', `${API_ENDPOINTS.base}-other/media`]) {
      http.get(url).subscribe();
      requests.expectOne(url).flush([]);
    }
    expect(begin).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it('honors context and legacy header exclusions', () => {
    http.get('/api/media', { context: new HttpContext().set(SKIP_ADMIN_LOADER, true) }).subscribe();
    requests.expectOne('/api/media').flush([]);
    http.get('/api/media', { headers: new HttpHeaders({ 'x-skip-admin-loader': 'true' }) }).subscribe();
    requests.expectOne('/api/media').flush([]);
    expect(begin).not.toHaveBeenCalled();
    expect(end).not.toHaveBeenCalled();
  });

  it('completes the correct operation on errors and cancellation', () => {
    begin.mockReturnValueOnce(11).mockReturnValueOnce(12);
    http.get('/api/articles').subscribe({ error: () => {} });
    requests.expectOne('/api/articles').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(end).toHaveBeenLastCalledWith(11);
    const subscription = http.get('/api/media').subscribe();
    const cancelled = requests.expectOne('/api/media');
    subscription.unsubscribe();
    expect(cancelled.cancelled).toBe(true);
    expect(end).toHaveBeenLastCalledWith(12);
    expect(end).toHaveBeenCalledTimes(2);
  });

  it('allocates a separate operation for each subscription to a cold request', () => {
    begin.mockReturnValueOnce(21).mockReturnValueOnce(22);
    const response = http.get('/api/articles');
    response.subscribe();
    response.subscribe();
    const pending = requests.match('/api/articles');
    expect(pending.length).toBe(2);
    expect(begin).toHaveBeenCalledTimes(2);
    pending[1].flush([]);
    expect(end).toHaveBeenLastCalledWith(22);
    pending[0].flush([]);
    expect(end).toHaveBeenLastCalledWith(21);
  });
});
