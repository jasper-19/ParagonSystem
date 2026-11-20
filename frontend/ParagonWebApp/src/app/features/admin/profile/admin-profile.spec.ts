import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminAuthService, AdminMeResponse } from '../../../core/services/admin-auth.service';
import { CollegeService } from '../../join/services/college.service';
import { ProfileSecuritySettings } from './components/security-settings/profile-security-settings';
import { AdminProfile } from './admin-profile';
import { SocketService } from '../../../core/services/socket.service';

@Component({ selector: 'app-security-settings', standalone: true, template: '' })
class SecurityStub {}

describe('Admin profile loading and recovery', () => {
  let fixture: ComponentFixture<AdminProfile>;
  let me: ReturnType<typeof vi.fn>;
  let staffUpdated: () => void;
  let listeners: Map<string, (payload?: string) => void>;
  let removeStaffListener: ReturnType<typeof vi.fn>;
  let removeListeners: Map<string, ReturnType<typeof vi.fn>>;
  const profile: AdminMeResponse = { user: { role: 'admin' }, staff: { id: 'sample', fullName: 'Sample Editor', email: 'sample@example.test' } };
  beforeEach(async () => {
    me = vi.fn(() => of(profile));
    listeners = new Map();
    removeListeners = new Map();
    removeStaffListener = vi.fn();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await TestBed.configureTestingModule({ imports: [AdminProfile], providers: [provideRouter([]),
      { provide: AdminAuthService, useValue: { me } },
      { provide: SocketService, useValue: {
        onStaffUpdated: (callback: () => void) => { staffUpdated = callback; return removeStaffListener; },
        on: (event: string, callback: (payload?: string) => void) => {
          listeners.set(event, callback);
          const remove = vi.fn(() => listeners.delete(event));
          removeListeners.set(event, remove);
          return remove;
        },
      } },
      { provide: CollegeService, useValue: { getColleges: () => of([]) } },
    ] }).overrideComponent(AdminProfile, { remove: { imports: [ProfileSecuritySettings] }, add: { imports: [SecurityStub] } }).compileComponents();
    fixture = TestBed.createComponent(AdminProfile);
  });
  afterEach(() => { fixture.destroy(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('retains loaded staff details while refresh is pending and after a refresh error', () => {
    fixture.detectChanges();
    const refresh = new Subject<AdminMeResponse>(); me.mockReturnValueOnce(refresh);
    fixture.componentInstance.refreshProfile(); fixture.detectChanges();
    expect(fixture.componentInstance.profile()).toEqual(profile);
    expect(fixture.nativeElement.querySelector('button[aria-label="Refreshing profile"]').disabled).toBe(true);
    refresh.error({ status: 503 }); fixture.detectChanges();
    expect(fixture.componentInstance.profile()).toEqual(profile);
    expect(fixture.componentInstance.profileRefreshing()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Existing details are still shown');
    expect(me).toHaveBeenLastCalledWith(true);
  });

  it('recovers from initial failure and identifies an unlinked staff account', () => {
    me.mockReturnValueOnce(throwError(() => ({ status: 500 })));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    me.mockReturnValueOnce(of({ user: { role: 'admin' }, staff: null }));
    fixture.componentInstance.refreshProfile(); fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('a[href="/admin/staff-directory"]');
    expect(link).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('No staff profile linked');
    expect(fixture.componentInstance.profileError()).toBe('');
  });

  it('explains an unverifiable session rather than rendering blank profile fields', () => {
    me.mockReturnValueOnce(throwError(() => ({ status: 401 })));
    fixture.detectChanges();
    expect(fixture.componentInstance.profileError()).toContain('sign in again');
    expect(fixture.nativeElement.querySelector('app-personal-information')).toBeNull();
  });

  it('fetches fresh details on entry, staff updates, and socket reconnection', () => {
    fixture.detectChanges();
    expect(me).toHaveBeenCalledWith(true);
    const updated: AdminMeResponse = { ...profile, staff: { ...profile.staff!, fullName: 'Updated Editor' } };
    me.mockReturnValueOnce(of(updated));
    staffUpdated(); fixture.detectChanges();
    expect(fixture.componentInstance.profile()).toEqual(updated);
    expect(fixture.nativeElement.textContent).toContain('Updated Editor');
    listeners.get('connect')!();
    expect(me).toHaveBeenCalledTimes(3);
    expect(me.mock.calls.every(call => call[0] === true)).toBe(true);
  });

  it('keeps only the newest response when a staff update arrives during a refresh', () => {
    fixture.detectChanges();
    const oldRequest = new Subject<AdminMeResponse>();
    const latestRequest = new Subject<AdminMeResponse>();
    me.mockReturnValueOnce(oldRequest).mockReturnValueOnce(latestRequest);
    fixture.componentInstance.refreshProfile();
    staffUpdated();
    expect(fixture.componentInstance.profileRefreshing()).toBe(true);
    const updated: AdminMeResponse = { ...profile, staff: { ...profile.staff!, fullName: 'Latest Editor' } };
    latestRequest.next(updated); latestRequest.complete();
    oldRequest.next(profile); oldRequest.complete();
    expect(fixture.componentInstance.profile()).toEqual(updated);
    expect(fixture.componentInstance.profileRefreshing()).toBe(false);
  });

  it('recovers on the next live update after a transient refresh failure', () => {
    fixture.detectChanges();
    me.mockReturnValueOnce(throwError(() => ({ status: 503 })));
    staffUpdated();
    expect(fixture.componentInstance.profile()).toEqual(profile);
    expect(fixture.componentInstance.profileError()).not.toBe('');
    staffUpdated();
    expect(fixture.componentInstance.profileError()).toBe('');
  });

  it('clears revoked profile details after a server disconnect but ignores network disconnects', () => {
    fixture.detectChanges();
    listeners.get('disconnect')!('transport close');
    expect(me).toHaveBeenCalledTimes(1);
    me.mockReturnValueOnce(throwError(() => ({ status: 401 })));
    listeners.get('disconnect')!('io server disconnect');
    fixture.detectChanges();
    expect(fixture.componentInstance.profile()).toBeNull();
    expect(fixture.componentInstance.profileError()).toContain('sign in again');
    expect(fixture.nativeElement.querySelector('app-personal-information')).toBeNull();
  });

  it('removes only its own listeners and cancels pending profile subscriptions on destroy', () => {
    fixture.detectChanges();
    const pending = new Subject<AdminMeResponse>();
    me.mockReturnValueOnce(pending);
    staffUpdated();
    fixture.destroy();
    expect(removeStaffListener).toHaveBeenCalledOnce();
    for (const remove of removeListeners.values()) expect(remove).toHaveBeenCalledOnce();
    pending.next({ user: null, staff: null });
    expect(fixture.componentInstance.profile()).toEqual(profile);
  });
});
