import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
});
