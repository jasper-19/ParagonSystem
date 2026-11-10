import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AdminAuthService, AdminMeResponse } from '../../../core/services/admin-auth.service';
import { CollegeService } from '../../join/services/college.service';
import { ProfileSecuritySettings } from './components/security-settings/profile-security-settings';
import { AdminProfile } from './admin-profile';

@Component({ selector: 'app-security-settings', standalone: true, template: '' })
class SecurityStub {}

describe('Admin profile loading and recovery', () => {
  let fixture: ComponentFixture<AdminProfile>;
  let me: ReturnType<typeof vi.fn>;
  const profile: AdminMeResponse = { user: { role: 'admin' }, staff: { id: 'sample', fullName: 'Sample Editor', email: 'sample@example.test' } };
  beforeEach(async () => {
    me = vi.fn(() => of(profile));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await TestBed.configureTestingModule({ imports: [AdminProfile], providers: [provideRouter([]),
      { provide: AdminAuthService, useValue: { me } },
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
});
