import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router, ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminLoginComponent } from './admin-login';
import { AdminAuthService, LoginResult } from '../../../core/services/admin-auth.service';

describe('Admin Google and email-code login', () => {
  let fixture: ComponentFixture<AdminLoginComponent>;
  let component: AdminLoginComponent;
  let auth: Record<string, ReturnType<typeof vi.fn>>;
  let query: Record<string, string>;
  let navigate: ReturnType<typeof vi.spyOn>;

  async function create(verification = false): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [AdminLoginComponent], providers: [provideRouter([]),
        { provide: AdminAuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { verification }, queryParamMap: convertToParamMap(query) } } },
      ],
    }).compileComponents();
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(AdminLoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(() => {
    query = {};
    auth = {
      loginChallenge: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 404 }))),
      login: vi.fn(() => of({ twoFactorRequired: true, maskedEmail: 'f***@gmail.com' })),
      linkGoogleAccount: vi.fn(() => of({ ok: true })),
      verifyLoginCode: vi.fn(() => of({ ok: true })),
      resendLoginCode: vi.fn(() => of({ maskedEmail: 'f***@gmail.com' })),
      cancelLogin: vi.fn(() => of({ ok: true })),
      finishGoogleLogin: vi.fn(() => of({ user: { role: 'admin' }, staff: null })),
    };
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('removes Facebook and keeps Google accessible', async () => {
    await create();
    expect(fixture.nativeElement.querySelector('[aria-label="Continue with Facebook"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Continue with Google"]').textContent).toContain('Continue with Google');
  });

  it('waits for the second factor before navigating and erases the password', async () => {
    await create();
    const route = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.form.setValue({ username: 'fixture', password: 'Fixture password 29!' });
    component.submit(); fixture.detectChanges();
    expect(component.form.controls.password.value).toBe('');
    expect(route).toHaveBeenCalledWith(['/admin/login/verify'], expect.any(Object));
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('#admin-email-code')).toBeNull();
  });

  it('validates six digits, prevents duplicate verification, and keeps failures on the code screen', async () => {
    auth['loginChallenge']!.mockReturnValue(of({ kind: 'email', maskedEmail: 'f***@gmail.com' }));
    await create(true);
    component.codeForm.setValue({ code: '123' }); component.verifyCode();
    expect(auth['verifyLoginCode']).not.toHaveBeenCalled();
    const pending = new Subject<LoginResult>(); auth['verifyLoginCode']!.mockReturnValue(pending);
    const input = fixture.nativeElement.querySelector('#admin-email-code') as HTMLInputElement;
    expect(input.autocomplete).toBe('one-time-code');
    input.value = '012 345';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.otp-slots span')).toHaveLength(6);
    expect(component.codeForm.controls.code.value).toBe('012345');
    component.verifyCode(); component.verifyCode();
    expect(auth['verifyLoginCode']).toHaveBeenCalledWith('012345');
    expect(auth['verifyLoginCode']).toHaveBeenCalledOnce();
    pending.error(new HttpErrorResponse({ status: 401, error: { error: 'Code expired.' } }));
    expect(component.emailStep()).toBe(true); expect(component.error()).toBe('Code expired.');
    expect(component.loading()).toBe(false); expect(navigate).not.toHaveBeenCalled();
  });

  it('returns to the requested admin page after successful verification', async () => {
    query = { returnUrl: '/admin/profile' };
    auth['loginChallenge']!.mockReturnValue(of({ kind: 'email', maskedEmail: 'f***@gmail.com' }));
    await create(true);
    component.codeForm.setValue({ code: '012345' });
    component.verifyCode();
    expect(auth['verifyLoginCode']).toHaveBeenCalledWith('012345');
    expect(navigate).toHaveBeenCalledWith('/admin/profile');
  });

  it('offers a way back when the verification request is missing', async () => {
    await create(true);
    expect(fixture.nativeElement.querySelector('#admin-username')).toBeNull();
    expect(fixture.nativeElement.querySelector('#admin-email-code')).toBeNull();
    expect(fixture.nativeElement.querySelector('a[href="/admin/login"]')).not.toBeNull();
    expect(component.error()).toContain('expired');
  });

  it('resumes first-time Google linking and uses the link endpoint', async () => {
    query = { google: 'link' };
    auth['loginChallenge']!.mockReturnValue(of({ kind: 'google-link', maskedEmail: 'f***@gmail.com' }));
    await create();
    component.form.setValue({ username: 'fixture', password: 'Fixture password 29!' }); component.submit();
    expect(auth['linkGoogleAccount']).toHaveBeenCalledWith('fixture', 'Fixture password 29!');
    expect(auth['login']).not.toHaveBeenCalled(); expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('checks the server session instead of trusting a Google success query parameter', async () => {
    query = { google: 'success' };
    auth['finishGoogleLogin']!.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    await create();
    expect(auth['finishGoogleLogin']).toHaveBeenCalledOnce(); expect(navigate).not.toHaveBeenCalled();
    expect(component.error()).toContain('could not be verified');
  });

  it('limits resend requests during the countdown', async () => {
    vi.useFakeTimers();
    auth['loginChallenge']!.mockReturnValue(of({ kind: 'email', maskedEmail: 'f***@gmail.com' }));
    await create(true);
    component.resendCode(); expect(auth['resendLoginCode']).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60_000); component.resendCode();
    expect(auth['resendLoginCode']).toHaveBeenCalledOnce(); expect(component.resendSeconds()).toBe(60);
  });
});
