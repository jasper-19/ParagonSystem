import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { GlobalSettingsService } from './global-settings.service';
import { SocketService, GlobalSettingsUpdatedPayload } from './socket.service';
import { GlobalSettingsSnapshot } from '../../models/global-settings.model';

const snapshot = (version: number): GlobalSettingsSnapshot => ({
  general: { siteName: `Publication ${version}`, organizationName: 'Campus', contactEmail: '', logoUrl: '', timezone: 'Asia/Manila', dateFormat: 'YYYY-MM-DD', timeFormat: '12h' },
  publishingMedia: { allowDirectPublishing: true, requireFeaturedImage: true, maxUploadSizeMb: 25, allowedMimeTypes: ['image/jpeg'], optimizeImages: true },
  notifications: { inAppEnabled: true, applicationEvents: true, articleCreated: true, articlePublished: true },
  maintenance: { enabled: false, message: 'Scheduled maintenance in progress.', allowAdminBypass: true },
  version, updatedAt: '2026-11-15T00:00:00Z', updatedBy: null,
});
const publicSnapshot = (version: number) => {
  const { general, maintenance } = snapshot(version);
  return { general, maintenance: { enabled: maintenance.enabled, message: maintenance.message }, version };
};

describe('GlobalSettingsService consistency', () => {
  let service: GlobalSettingsService;
  let http: HttpTestingController;
  let remote: (event: GlobalSettingsUpdatedPayload) => void;
  let connect: () => void;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), {
      provide: SocketService, useValue: {
        onGlobalSettingsUpdated: (callback: typeof remote) => { remote = callback; },
        on: (_event: string, callback: () => void) => { connect = callback; },
      },
    }] });
    service = TestBed.inject(GlobalSettingsService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });
  const fullRequest = () => http.expectOne(req => req.method === 'GET' && !req.url.includes('/public'));

  it('keeps full and public state at the latest version despite reordered responses', () => {
    service.load().subscribe();
    const oldRead = fullRequest();
    service.updateSection('general', snapshot(2).general, 1).subscribe();
    http.expectOne(req => req.method === 'PATCH').flush(snapshot(2));
    oldRead.flush(snapshot(1));
    expect(service.settings()?.version).toBe(2);
    expect(service.publicSettings()?.version).toBe(2);
    expect(document.title).toContain('Publication 2');
    service.loadPublic().subscribe();
    http.expectOne(req => req.url.includes('/public')).flush(publicSnapshot(1));
    expect(service.publicSettings()?.version).toBe(2);
  });

  it('fetches a conflict snapshot while returning the original save error', () => {
    service.load().subscribe(); fullRequest().flush(snapshot(1));
    const error = vi.fn();
    service.updateSection('general', snapshot(1).general, 1).subscribe({ error });
    http.expectOne(req => req.method === 'PATCH').flush({ error: 'Settings changed' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledOnce();
    fullRequest().flush(snapshot(2));
    expect(service.settings()?.version).toBe(2);
  });

  it('does not lose a newer event arriving during a failed refresh', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    service.load().subscribe(); fullRequest().flush(snapshot(1));
    remote({ section: 'general', version: 2, updatedAt: snapshot(2).updatedAt });
    const publicRead = http.expectOne(req => req.url.includes('/public'));
    const fullRead = fullRequest();
    remote({ section: 'general', version: 3, updatedAt: snapshot(3).updatedAt });
    publicRead.flush({}, { status: 503, statusText: 'Unavailable' });
    fullRead.flush({}, { status: 503, statusText: 'Unavailable' });
    http.expectOne(req => req.url.includes('/public')).flush(publicSnapshot(3));
    fullRequest().flush(snapshot(3));
    expect(service.settings()?.version).toBe(3);
    expect(service.publicSettings()?.version).toBe(3);
    vi.restoreAllMocks();
  });

  it('keeps newer public maintenance when an older private read completes', () => {
    service.load().subscribe(); const oldRead = fullRequest();
    service.loadPublic().subscribe();
    const latest = publicSnapshot(3); latest.maintenance.enabled = true;
    http.expectOne(req => req.url.includes('/public')).flush(latest);
    oldRead.flush(snapshot(2));
    expect(service.publicSettings()?.maintenance.enabled).toBe(true);
    expect(service.publicSettings()?.version).toBe(3);
  });

  it('bounds refreshes when a server returns an older version and recovers on reconnect', () => {
    service.load().subscribe(); fullRequest().flush(snapshot(1));
    remote({ section: 'general', version: 2, updatedAt: snapshot(2).updatedAt });
    http.expectOne(req => req.url.includes('/public')).flush(publicSnapshot(1));
    fullRequest().flush(snapshot(1));
    // One follow-up handles a read already in flight before the commit.
    http.expectOne(req => req.url.includes('/public')).flush(publicSnapshot(1));
    fullRequest().flush(snapshot(1));
    http.expectNone(() => true);
    connect();
    http.expectOne(req => req.url.includes('/public')).flush(publicSnapshot(2));
    fullRequest().flush(snapshot(2));
    expect(service.settings()?.version).toBe(2);
    expect(service.publicSettings()?.version).toBe(2);
  });
});
