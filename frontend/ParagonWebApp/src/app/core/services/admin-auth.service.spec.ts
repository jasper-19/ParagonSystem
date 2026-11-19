import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { AdminAuthService } from './admin-auth.service';
import { SocketService } from './socket.service';
import { API_ENDPOINTS } from '../config/api.config';

describe('Admin auth pending-session contract', () => {
  let http: HttpTestingController;
  let service: AdminAuthService;
  const reconnect = vi.fn();
  beforeEach(() => {
    reconnect.mockReset();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: SocketService, useValue: { reconnectWithCurrentSession: reconnect } }] });
    service = TestBed.inject(AdminAuthService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });
  it('does not reconnect authenticated sockets until email verification completes', () => {
    service.login('fixture', 'Fixture password 29!').subscribe();
    http.expectOne(`${API_ENDPOINTS.auth}/login`).flush({ twoFactorRequired: true, maskedEmail: 'f***@gmail.com' });
    expect(reconnect).not.toHaveBeenCalled();
    service.verifyLoginCode('123456').subscribe();
    const verify = http.expectOne(`${API_ENDPOINTS.auth}/2fa/verify`);
    expect(verify.request.body).toEqual({ code: '123456' }); verify.flush({ ok: true });
    expect(reconnect).toHaveBeenCalledOnce();
  });
});
