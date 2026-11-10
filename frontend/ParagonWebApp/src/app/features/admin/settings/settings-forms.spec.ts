import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { GlobalSettingsService } from '../../../core/services/global-settings.service';
import { GlobalSettingsSnapshot } from '../../../models/global-settings.model';
import { GeneralSettingsComponent } from './tabs/general-settings/general-settings';
import { PublishingMediaSettingsComponent } from './tabs/publishing-media-settings/publishing-media-settings';
import { MaintenanceSettingsComponent } from './tabs/maintenance-settings/maintenance-settings';
import { NotificationSettingsComponent } from './tabs/notification-settings/notification-settings';

const snapshot = (): GlobalSettingsSnapshot => ({
  general: { siteName: 'Sample Publication', organizationName: 'Sample Campus', contactEmail: 'editor@example.test', logoUrl: '', timezone: 'Asia/Manila', dateFormat: 'YYYY-MM-DD', timeFormat: '12h' },
  publishingMedia: { allowDirectPublishing: true, requireFeaturedImage: true, maxUploadSizeMb: 25, allowedMimeTypes: ['image/jpeg'], optimizeImages: true },
  notifications: { inAppEnabled: true, applicationEvents: true, articleCreated: true, articlePublished: true },
  maintenance: { enabled: false, message: 'Scheduled maintenance in progress.', allowAdminBypass: true },
  version: 3, updatedAt: '2026-11-07T00:00:00Z', updatedBy: null,
});

describe('Settings form safeguards', () => {
  let fixture: ComponentFixture<GeneralSettingsComponent | PublishingMediaSettingsComponent | MaintenanceSettingsComponent | NotificationSettingsComponent>;
  let response: Subject<GlobalSettingsSnapshot>;
  let updateSection: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    response = new Subject();
    updateSection = vi.fn(() => response.asObservable());
    await TestBed.configureTestingModule({
      imports: [GeneralSettingsComponent, PublishingMediaSettingsComponent, MaintenanceSettingsComponent, NotificationSettingsComponent],
      providers: [{ provide: GlobalSettingsService, useValue: { updateSection } }],
    }).compileComponents();
  });

  afterEach(() => {
    fixture?.destroy(); response.complete(); TestBed.resetTestingModule();
  });

  function general(): GeneralSettingsComponent {
    fixture = TestBed.createComponent(GeneralSettingsComponent);
    fixture.componentRef.setInput('settings', snapshot().general);
    fixture.componentRef.setInput('version', 3);
    fixture.detectChanges();
    return fixture.componentInstance as GeneralSettingsComponent;
  }

  it('blocks invalid settings and marks fields for validation feedback', () => {
    const component = general();
    component.form.controls.contactEmail.setValue('invalid');
    component.form.controls.logoUrl.setValue('http://example.test/logo.png');
    component.save();
    expect(updateSection).not.toHaveBeenCalled();
    expect(component.form.controls.contactEmail.touched).toBe(true);
    expect(component.form.controls.logoUrl.invalid).toBe(true);
  });

  it('sends one versioned save while pending and accepts the successful snapshot', () => {
    const component = general();
    component.form.controls.siteName.setValue('Updated Publication');
    component.form.markAsDirty();
    component.save(); component.save();
    expect(updateSection).toHaveBeenCalledExactlyOnceWith('general', expect.objectContaining({ siteName: 'Updated Publication' }), 3);
    expect(component.saving()).toBe(true);
    const saved = snapshot(); saved.version = 4; saved.general.siteName = 'Updated Publication';
    response.next(saved); response.complete();
    expect(component.saving()).toBe(false);
    expect(component.form.pristine).toBe(true);
    expect(component.messageKind()).toBe('success');
  });

  it('preserves dirty edits on external updates and resets only when latest is requested', () => {
    const component = general();
    component.form.controls.siteName.setValue('Local Draft'); component.form.markAsDirty();
    fixture.componentRef.setInput('settings', { ...snapshot().general, siteName: 'Remote Update' });
    fixture.componentRef.setInput('version', 4); fixture.detectChanges();
    expect(component.externalUpdate()).toBe(true);
    expect(component.form.controls.siteName.value).toBe('Local Draft');
    component.save(); expect(updateSection).not.toHaveBeenCalled();
    component.loadLatest();
    expect(component.form.controls.siteName.value).toBe('Remote Update');
    expect(component.form.pristine).toBe(true);
    expect(component.externalUpdate()).toBe(false);
  });

  it('keeps edits after a version conflict and permits retry after the request settles', () => {
    const component = general();
    component.form.controls.siteName.setValue('Local Draft'); component.form.markAsDirty(); component.save();
    response.error({ status: 409, error: { error: 'Settings changed in another session.' } });
    expect(component.saving()).toBe(false);
    expect(component.messageKind()).toBe('error');
    expect(component.message()).toContain('another session');
    expect(component.form.controls.siteName.value).toBe('Local Draft');
    expect(component.form.dirty).toBe(true);
  });

  it('rejects empty MIME selection and out-of-range upload limits, without duplicate types', () => {
    fixture = TestBed.createComponent(PublishingMediaSettingsComponent);
    fixture.componentRef.setInput('settings', snapshot().publishingMedia); fixture.componentRef.setInput('version', 3); fixture.detectChanges();
    const component = fixture.componentInstance as PublishingMediaSettingsComponent;
    component.toggleMediaType('image/jpeg', true);
    expect(component.form.controls.allowedMimeTypes.value).toEqual(['image/jpeg']);
    component.toggleMediaType('image/jpeg', false); component.save();
    expect(updateSection).not.toHaveBeenCalled();
    component.toggleMediaType('application/pdf', true);
    component.form.controls.maxUploadSizeMb.setValue(101); component.save();
    expect(updateSection).not.toHaveBeenCalled();
    component.form.controls.maxUploadSizeMb.setValue(100); component.save();
    expect(updateSection).toHaveBeenCalledExactlyOnceWith('publishingMedia', expect.objectContaining({ allowedMimeTypes: ['application/pdf'], maxUploadSizeMb: 100 }), 3);
  });

  it('requires explicit confirmation to enable maintenance and clears confirmation after success', () => {
    fixture = TestBed.createComponent(MaintenanceSettingsComponent);
    fixture.componentRef.setInput('settings', snapshot().maintenance); fixture.componentRef.setInput('version', 3); fixture.detectChanges();
    const component = fixture.componentInstance as MaintenanceSettingsComponent;
    component.form.controls.enabled.setValue(true); component.save();
    expect(updateSection).not.toHaveBeenCalled();
    expect(component.messageKind()).toBe('error');
    component.confirmationChanged({ target: { checked: true } } as unknown as Event);
    component.save(); component.save();
    expect(updateSection).toHaveBeenCalledExactlyOnceWith('maintenance', expect.objectContaining({ enabled: true, allowAdminBypass: true }), 3);
    const saved = snapshot(); saved.maintenance.enabled = true; saved.version = 4;
    response.next(saved); response.complete();
    expect(component.enableConfirmed()).toBe(false);
    expect(component.saving()).toBe(false);
    expect(component.form.pristine).toBe(true);
  });

  it('saves changed notification rules while preserving independently selected event flags', () => {
    fixture = TestBed.createComponent(NotificationSettingsComponent);
    fixture.componentRef.setInput('settings', snapshot().notifications); fixture.componentRef.setInput('version', 3); fixture.detectChanges();
    const component = fixture.componentInstance as NotificationSettingsComponent;
    component.save(); expect(updateSection).not.toHaveBeenCalled();
    component.form.controls.inAppEnabled.setValue(false); component.form.markAsDirty();
    component.save(); component.save();
    expect(updateSection).toHaveBeenCalledExactlyOnceWith('notifications', { inAppEnabled: false, applicationEvents: true, articleCreated: true, articlePublished: true }, 3);
    const saved = snapshot(); saved.notifications.inAppEnabled = false;
    response.next(saved); response.complete();
    expect(component.form.pristine).toBe(true);
    expect(component.messageKind()).toBe('success');
  });
});
