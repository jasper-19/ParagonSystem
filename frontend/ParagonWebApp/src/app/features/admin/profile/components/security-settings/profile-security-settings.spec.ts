import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, defer, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter, Router } from '@angular/router';
import { ActiveSession, AdminAuthService } from '../../../../../core/services/admin-auth.service';
import { ProfileSecuritySettings } from './profile-security-settings';

describe('Profile account security', () => {
  let fixture: ComponentFixture<ProfileSecuritySettings>;
  let component: ProfileSecuritySettings;
  let auth: { me: ReturnType<typeof vi.fn>; getSessions: ReturnType<typeof vi.fn>; changePassword: ReturnType<typeof vi.fn>; setTwoFaEnabled: ReturnType<typeof vi.fn>; logoutSession: ReturnType<typeof vi.fn>; invalidateMeCache: ReturnType<typeof vi.fn> };
  const current: ActiveSession = { id: 'sample-current', browser: 'Sample browser', os: 'Sample OS', device: 'Desktop', lastActive: new Date('2026-11-10T00:00:00Z'), current: true };
  const other: ActiveSession = { ...current, id: 'sample-other', current: false };
  const validForm = () => {
    component.passwordForm.setValue({ currentPassword: ['Sample', 'Current', '7!'].join(''), newPassword: ['Sample', 'Replacement', '9!'].join(''), confirmPassword: ['Sample', 'Replacement', '9!'].join('') });
    component.passwordForm.markAsDirty();
  };
  beforeEach(async () => {
    auth = { me: vi.fn(() => of({ user: { twoFaEnabled: true }, staff: null })), getSessions: vi.fn(() => of([current, other])), changePassword: vi.fn(() => of(undefined)), setTwoFaEnabled: vi.fn(() => of({ twoFaEnabled: false })), logoutSession: vi.fn(() => of(undefined)), invalidateMeCache: vi.fn() };
    vi.spyOn(console, 'error').mockImplementation(() => {}); vi.spyOn(console, 'warn').mockImplementation(() => {});
    await TestBed.configureTestingModule({ imports: [ProfileSecuritySettings], providers: [provideRouter([]), { provide: AdminAuthService, useValue: auth }] }).compileComponents();
    fixture = TestBed.createComponent(ProfileSecuritySettings); component = fixture.componentInstance;
    fixture.detectChanges();
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('prevents empty, weak, reused, and mismatched password submissions', () => {
    component.changePassword();
    expect(component.passwordForm.touched).toBe(true); expect(auth.changePassword).not.toHaveBeenCalled();
    validForm(); component.newPasswordControl.setValue(['Short', '7!'].join(''));
    expect(component.newPasswordControl.hasError('minlength')).toBe(true);
    expect(component.hasMinimumLength).toBe(false);
    component.newPasswordControl.setValue('lowercaseonlysample');
    expect(component.newPasswordControl.hasError('passwordComplexity')).toBe(true);
    validForm(); component.newPasswordControl.setValue(component.currentPasswordControl.value); component.confirmPasswordControl.setValue(component.currentPasswordControl.value);
    expect(component.passwordForm.hasError('passwordUnchanged')).toBe(true);
    validForm(); component.confirmPasswordControl.setValue('different sample');
    expect(component.passwordForm.hasError('passwordsMismatch')).toBe(true);
    component.changePassword(); expect(auth.changePassword).not.toHaveBeenCalled();
  });

  it('requires twelve characters in both the form and the length indicator', () => {
    component.newPasswordControl.setValue(['Sample', '7!xx'].join(''));
    expect(component.newPasswordControl.hasError('minlength')).toBe(true);
    expect(component.hasMinimumLength).toBe(false);
    validForm(); expect(component.passwordForm.valid).toBe(true); expect(component.hasMinimumLength).toBe(true);
  });

  it('toggles only the requested password field and exposes its pressed state', () => {
    const button = fixture.nativeElement.querySelector('button[aria-label="Show new password"]') as HTMLButtonElement;
    button.click(); fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#new-password').type).toBe('text');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('#current-password').type).toBe('password');
    expect(fixture.nativeElement.querySelector('#confirm-password').type).toBe('password');
  });

  it('prevents duplicate password requests and requires a fresh sign-in after success', () => {
    const pending = new Subject<void>(); auth.changePassword.mockReturnValueOnce(pending);
    validForm(); component.showNewPassword = true;
    component.changePassword(); component.changePassword();
    expect(auth.changePassword).toHaveBeenCalledOnce(); expect(component.changingPassword).toBe(true); expect(component.canSubmitPasswordChange).toBe(false);
    pending.next(); pending.complete();
    expect(component.changingPassword).toBe(false); expect(component.successPasswordModalOpen).toBe(true);
    expect(Object.values(component.passwordForm.getRawValue()).every(value => value === '')).toBe(true);
    expect(component.passwordForm.pristine).toBe(true); expect(component.passwordForm.untouched).toBe(true);
    expect(component.showNewPassword).toBe(false); expect(auth.getSessions).toHaveBeenCalledTimes(1);
    expect(component.activeSessions).toEqual([]);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.closePasswordSuccess();
    expect(navigate).toHaveBeenCalledWith(['/admin/login']);
  });

  it('restores submission availability after a password error without claiming success', () => {
    auth.changePassword.mockReturnValueOnce(throwError(() => ({ error: { error: 'Synthetic request failure' } })));
    validForm(); component.changePassword();
    expect(component.errorPasswordModalOpen).toBe(true); expect(component.successPasswordModalOpen).toBe(false);
    expect(component.changingPassword).toBe(false); expect(component.canSubmitPasswordChange).toBe(true);
    expect(component.errorPasswordModalMessage).toBe('Synthetic request failure');
    component.closePasswordError(); expect(component.errorPasswordModalOpen).toBe(false);
  });

  it('requires a new login when the server revokes sessions after a 2FA change', () => {
    auth.setTwoFaEnabled.mockReturnValueOnce(of({ twoFaEnabled: false, reauthenticationRequired: true }));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    component.setTwoFA(false);
    expect(navigate).toHaveBeenCalledWith(['/admin/login'], { queryParams: { twoFaChanged: 'true' } });
  });

  it('disables the 2FA control while updating and rolls back on failure', () => {
    const pending = new Subject<{ twoFaEnabled: boolean }>(); auth.setTwoFaEnabled.mockReturnValueOnce(pending);
    const toggle = fixture.nativeElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
    toggle.click(); fixture.detectChanges();
    expect(component.twoFAEnabled).toBe(false); expect(component.twoFaUpdating).toBe(true);
    expect(fixture.nativeElement.querySelector('input[type="checkbox"]').disabled).toBe(true);
    pending.error({ error: { error: 'Synthetic update failure' } }); fixture.detectChanges();
    expect(component.twoFAEnabled).toBe(true); expect(component.twoFaUpdating).toBe(false);
    expect(component.twoFaMessageKind).toBe('error'); expect(auth.invalidateMeCache).not.toHaveBeenCalled();
    component.setTwoFA(false);
    expect(component.twoFAEnabled).toBe(false); expect(component.twoFaMessageKind).toBe('success'); expect(auth.invalidateMeCache).toHaveBeenCalledOnce();
  });

  it('protects the current session, prevents duplicate sign-outs, and preserves a failed session for retry', () => {
    component.logoutSession(current); expect(auth.logoutSession).not.toHaveBeenCalled();
    const pending = new Subject<void>(); auth.logoutSession.mockReturnValueOnce(pending);
    component.logoutSession(other); component.logoutSession(other);
    expect(auth.logoutSession).toHaveBeenCalledOnce(); expect(auth.logoutSession).toHaveBeenCalledWith(other.id);
    expect(component.loggingOutSessionIds[other.id]).toBe(true);
    pending.error({ status: 500 });
    expect(component.activeSessions).toHaveLength(2); expect(component.loggingOutSessionIds[other.id]).toBe(false); expect(component.sessionActionError).not.toBe('');
    component.logoutSession(other);
    expect(component.activeSessions.map(session => session.id)).toEqual([current.id]); expect(component.sessionActionError).toBe('');
  });

  it('retries a transient session failure once and permits manual recovery from a nonretryable failure', async () => {
    vi.useFakeTimers(); let attempts = 0;
    auth.getSessions.mockReturnValueOnce(defer(() => ++attempts === 1 ? throwError(() => ({ status: 503 })) : of([current])));
    component.retrySessions(); expect(component.sessionsLoading).toBe(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(attempts).toBe(2); expect(component.sessionsLoading).toBe(false); expect(component.activeSessions).toEqual([current]);
    auth.getSessions.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    component.retrySessions(); expect(component.sessionsError).not.toBe(''); expect(component.activeSessions).toEqual([]);
    component.retrySessions(); expect(component.sessionsError).toBe(''); expect(component.activeSessions).toHaveLength(2);
  });
});
