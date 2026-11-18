import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { authInterceptor } from './auth.interceptor';
import { API_ENDPOINTS } from '../config/api.config';

describe('authInterceptor destination boundary', () => {
  let http: HttpClient;
  let requests: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    http = TestBed.inject(HttpClient);
    requests = TestBed.inject(HttpTestingController);
  });
  afterEach(() => requests.verify());
  it('attaches credentials and CSRF protection to API mutations', () => {
    const url = `${API_ENDPOINTS.base}/auth/logout`;
    http.post(url, {}).subscribe();
    const req = requests.expectOne(url);
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.get('X-CSRF-Protection')).toBe('1');
    req.flush({});
  });
  it('does not trust a matching URL prefix outside the API path', () => {
    const url = `${API_ENDPOINTS.base}-attacker/logout`;
    http.post(url, {}).subscribe();
    const req = requests.expectOne(url);
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('X-CSRF-Protection')).toBe(false);
    req.flush({});
  });
});
