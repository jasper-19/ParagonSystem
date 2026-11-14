import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApplicationService } from '../../../../core/services/application.service';
import { Application } from '../../../../models/application.model';
import { ApplicationSettings } from '../../../../models/application-settings.model';
import { JoinService } from '../../../join/services/join.service';
import { ApplicationsComponent } from './applications';

describe('Applications workspace interactions', () => {
  const application: Application = { id: 'sample-application', fullName: 'Sample Applicant', email: 'sample@example.test', studentId: 'SAMPLE-001', yearLevel: '1st_year', collegeId: 'sample-college', programId: 'sample-program', motivation: 'Synthetic application for interaction testing.', status: 'pending' };
  const settings: ApplicationSettings = { isOpen: true, announcement: 'Applications are open for the sample publication.', updatedAt: '2026-11-07T00:00:00Z' };
  let fixture: ComponentFixture<ApplicationsComponent>;
  let component: ApplicationsComponent;
  let settingsChanges: BehaviorSubject<ApplicationSettings>;
  let service: Record<string, any>;

  beforeEach(async () => {
    settingsChanges = new BehaviorSubject(settings);
    service = {
      applications$: of([]), applicationSettings$: settingsChanges,
      loading: signal(false), loaded: signal(true), loadError: signal(null),
      totalApplications: signal(65), totalPagesCount: signal(7), activePage: signal(1), activePageSize: signal(10),
      refresh: vi.fn(), getApplicationSettings: vi.fn(() => of(settings)), updateApplicationSettings: vi.fn(() => of(settings)),
      scheduleInterview: vi.fn(), markInterviewed: vi.fn(), acceptApplication: vi.fn(), rejectApplication: vi.fn(),
      addInterviewNotes: vi.fn(), deleteApplication: vi.fn(),
    };
    await TestBed.configureTestingModule({ imports: [ApplicationsComponent], providers: [
      { provide: ApplicationService, useValue: service },
      { provide: JoinService, useValue: { getOpenPositions: () => of([]) } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(ApplicationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); await fixture.whenStable();
  });
  afterEach(() => { fixture.destroy(); settingsChanges.complete(); TestBed.resetTestingModule(); vi.useRealTimers(); vi.restoreAllMocks(); });

  it('retains the selected status and trimmed search across paging and page-size changes', async () => {
    vi.useFakeTimers();
    component.setFilter('interview_scheduled');
    component.onSearch({ target: { value: '  sample  ' } } as unknown as Event);
    await vi.advanceTimersByTimeAsync(349);
    expect(service['refresh']).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(service['refresh']).toHaveBeenLastCalledWith(1, 10, 'interview_scheduled', 'sample');
    component.setPage(3);
    expect(service['refresh']).toHaveBeenLastCalledWith(3, 10, 'interview_scheduled', 'sample');
    component.onPageSizeChange({ target: { value: '20' } } as unknown as Event);
    expect(service['refresh']).toHaveBeenLastCalledWith(1, 20, 'interview_scheduled', 'sample');
    const calls = service['refresh'].mock.calls.length;
    component.onPageSizeChange({ target: { value: '-1' } } as unknown as Event);
    expect(service['refresh']).toHaveBeenCalledTimes(calls);
    component.clearSearch(); await vi.advanceTimersByTimeAsync(350);
    expect(service['refresh']).toHaveBeenLastCalledWith(1, 10, 'interview_scheduled', undefined);
  });

  it('guards concurrent review decisions and preserves an actionable error after a failed request', () => {
    const accept = new Subject<Application>();
    service['acceptApplication'].mockReturnValue(accept);
    component.selectedApplication = application;
    component.accept(application, 'Sample interview notes');
    component.accept(application, 'Duplicate');
    component.reject(application, 'Competing decision');
    expect(service['acceptApplication']).toHaveBeenCalledExactlyOnceWith(application.id, 'Sample interview notes');
    expect(service['rejectApplication']).not.toHaveBeenCalled();
    expect(component.reviewAction()).toBe('accept');
    accept.error({ error: { error: 'Sample request could not be completed.' } });
    expect(component.reviewAction()).toBeNull();
    expect(component.reviewActionError()).toBe('Sample request could not be completed.');
    expect(component.selectedApplication).toBe(application);
    service['rejectApplication'].mockReturnValue(of({ ...application, status: 'rejected' }));
    component.reject(application, '');
    expect(service['rejectApplication']).toHaveBeenCalledWith(application.id, undefined);
    expect(component.reviewActionError()).toBe('');
    expect(component.selectedApplication).toBeNull();
  });

  it('protects a typed announcement from realtime updates and requires confirmation to change intake', async () => {
    const textarea = fixture.nativeElement.querySelector('#applicationAnnouncement') as HTMLTextAreaElement;
    textarea.value = '  Updated sample recruitment announcement.  ';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges(); await fixture.whenStable();
    settingsChanges.next({ ...settings, announcement: 'External sample announcement.' });
    expect(component.announcementDraft()).toBe('  Updated sample recruitment announcement.  ');
    component.requestApplicationWindowChange('close');
    expect(service['updateApplicationSettings']).not.toHaveBeenCalled();
    component.cancelApplicationWindowChange(); component.confirmApplicationWindowChange();
    expect(service['updateApplicationSettings']).not.toHaveBeenCalled();
    component.requestApplicationWindowChange('close'); component.confirmApplicationWindowChange();
    expect(service['updateApplicationSettings']).toHaveBeenCalledExactlyOnceWith({ isOpen: false, announcement: 'Updated sample recruitment announcement.' });
    expect(component.pendingSettingsAction).toBeNull();
    expect(component.showSettingsConfirm).toBe(false);
    expect(component.announcementDirty()).toBe(false);
  });

  it('exports one CSV value per header and escapes applicant names containing commas and quotes', async () => {
    let exported: Blob | undefined;
    const originalCreate = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
    const originalRevoke = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn((blob: Blob) => { exported = blob; return 'blob:sample-export'; }) });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      component.exportApplications([{ ...application, fullName: 'Sample, "Applicant"', selectedPositions: [{ positionId: 'writer', categories: ['News'] }] }]);
      const csv = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsText(exported!);
      });
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Name,Email,StudentID,Positions & Categories,Status,InterviewDate');
      expect(lines[1]).toBe(['"Sample, ""Applicant"""', 'sample@example.test', 'SAMPLE-001', 'writer (News)', 'Pending', component.formatInterviewDate(undefined)].join(','));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:sample-export');
    } finally {
      if (originalCreate) Object.defineProperty(URL, 'createObjectURL', originalCreate); else Reflect.deleteProperty(URL, 'createObjectURL');
      if (originalRevoke) Object.defineProperty(URL, 'revokeObjectURL', originalRevoke); else Reflect.deleteProperty(URL, 'revokeObjectURL');
    }
  });

  it('rejects short announcements and leaves deletion untouched when confirmation is cancelled', () => {
    component.onAnnouncementChange('short'); component.saveAnnouncement();
    expect(component.settingsError()).toContain('at least 10 characters');
    expect(service['updateApplicationSettings']).not.toHaveBeenCalled();
    const event = { stopPropagation: vi.fn() } as unknown as Event;
    component.requestDelete(application, event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.showDeleteConfirm).toBe(true);
    expect(service['deleteApplication']).not.toHaveBeenCalled();
    component.cancelDelete(); component.confirmDelete();
    expect(service['deleteApplication']).not.toHaveBeenCalled();
    expect(component.appToDelete).toBeNull();
  });
});
