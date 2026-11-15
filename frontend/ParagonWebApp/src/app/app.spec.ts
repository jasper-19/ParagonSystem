import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { App } from './app';
import { GlobalSettingsService } from './core/services/global-settings.service';
import { SocketService } from './core/services/socket.service';
import { PublicGlobalSettings } from './models/global-settings.model';

describe('Application shell', () => {
  const settings = signal<PublicGlobalSettings | null>(null);
  const connect = vi.fn();
  beforeEach(() => {
    settings.set(null);
    connect.mockReset();
    TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([]),
        { provide: SocketService, useValue: { connect } },
        { provide: GlobalSettingsService, useValue: { publicSettings: settings, loadPublic: () => of(settings()) } },
      ],
    });
  });

  it('renders the route outlet and initializes site services without a live network', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(connect).toHaveBeenCalledOnce();
  });

  it('renders the public maintenance message instead of route content when enabled', () => {
    settings.set({
      general: { siteName: 'Paragon', organizationName: 'Campus publication', contactEmail: '', logoUrl: '', timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY', timeFormat: '12h' },
      maintenance: { enabled: true, message: 'Scheduled publication maintenance.' }, version: 1,
    });
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
    expect(fixture.nativeElement.querySelector('#maintenance-title')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Scheduled publication maintenance.');
  });

  function maintenanceSettings(logoUrl = ''): PublicGlobalSettings {
    return {
      general: {
        siteName: 'The Campus Journal', organizationName: 'Student Publications Office',
        contactEmail: '', logoUrl, timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY',
        timeFormat: '12h',
      },
      maintenance: { enabled: true, message: 'Our publication archive is being updated.' },
      version: 2,
    };
  }

  it('shows the configured publication branding and maintenance message', () => {
    settings.set(maintenanceSettings('/assets/custom-publication-logo.png'));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const page: HTMLElement = fixture.nativeElement;
    const logo = page.querySelector('img');
    expect(logo?.getAttribute('src')).toBe('/assets/custom-publication-logo.png');
    expect(logo?.getAttribute('alt')).toBe('The Campus Journal logo');
    expect(page.textContent).toContain('The Campus Journal');
    expect(page.textContent).toContain('Student Publications Office');
    expect(page.textContent).toContain('Our publication archive is being updated.');
  });

  it('uses the publication logo fallback when no custom logo is configured', () => {
    settings.set(maintenanceSettings());
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('img')?.getAttribute('src'))
      .toBe('assets/PRG_Logo.png');
  });

  it('restores public route content when maintenance is disabled by a settings update', () => {
    const enabledSettings = maintenanceSettings();
    settings.set(enabledSettings);
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();

    settings.set({
      ...enabledSettings,
      maintenance: { ...enabledSettings.maintenance, enabled: false },
      version: 3,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#maintenance-title')).toBeNull();
  });

  it('keeps admin routes accessible and reapplies maintenance when returning to a public route', () => {
    settings.set(maintenanceSettings());
    const navigationEvents = new Subject<NavigationEnd>();
    const eventsSpy = vi.spyOn(TestBed.inject(Router), 'events', 'get')
      .mockReturnValue(navigationEvents);
    const scrollSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});

    try {
      const fixture = TestBed.createComponent(App);
      fixture.detectChanges();

      navigationEvents.next(new NavigationEnd(1, '/admin', '/admin/dashboard'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('router-outlet')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('#maintenance-title')).toBeNull();

      navigationEvents.next(new NavigationEnd(2, '/', '/'));
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('router-outlet')).toBeNull();
      expect(fixture.nativeElement.querySelector('#maintenance-title')).not.toBeNull();
    } finally {
      navigationEvents.complete();
      eventsSpy.mockRestore();
      scrollSpy.mockRestore();
    }
  });
});
