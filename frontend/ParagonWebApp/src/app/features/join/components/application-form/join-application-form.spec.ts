import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { JoinApplicationForm } from './join-application-form';
import { ApplicationService } from '../../../../core/services/application.service';
import { CollegeService } from '../../services/college.service';
import { JoinPosition } from '../../models/join-position.model';

describe('Recruitment application validation and recovery', () => {
  let fixture: ComponentFixture<JoinApplicationForm>;
  let page: JoinApplicationForm;
  const getColleges = vi.fn();
  const submit = vi.fn();
  const refreshApplicationSettings = vi.fn();
  const colleges = [
    { id: 'arts', name: 'Arts', programs: [{ id: 'journalism', name: 'Journalism' }] },
    { id: 'science', name: 'Science', programs: [{ id: 'biology', name: 'Biology' }] },
  ];
  const positions: JoinPosition[] = [{ id: 'writer', title: 'Staff Writer', department: 'Editorial', description: 'Write campus stories.', isOpen: true, subRoles: [{ name: 'News', description: 'Report news.' }] }];

  beforeEach(() => {
    getColleges.mockReset().mockReturnValue(of(colleges));
    submit.mockReset();
    refreshApplicationSettings.mockReset();
    TestBed.configureTestingModule({ imports: [JoinApplicationForm], providers: [provideRouter([]),
      { provide: CollegeService, useValue: { getColleges } },
      { provide: ApplicationService, useValue: { submit, refreshApplicationSettings } },
    ] });
  });
  afterEach(() => { fixture?.destroy(); TestBed.resetTestingModule(); });
  function create() {
    fixture = TestBed.createComponent(JoinApplicationForm);
    fixture.componentRef.setInput('positions', positions);
    page = fixture.componentInstance;
    fixture.detectChanges();
  }
  function fill() {
    page.form.patchValue({ fullName: 'Test Applicant', email: 'test@example.com', studentId: '26-12345', yearLevel: '1st_year', collegeId: 'arts', motivation: 'I want to contribute to thoughtful campus reporting.' });
    fixture.detectChanges();
    page.form.controls.programId.setValue('journalism');
    page.togglePosition('writer');
    page.toggleCategory('writer', 'News');
    fixture.detectChanges();
  }

  it('clears a program that belongs to the previous college', () => {
    create();
    expect(page.form.controls.programId.disabled).toBe(true);
    fill();
    expect(page.form.valid).toBe(true);
    page.form.controls.collegeId.setValue('science');
    fixture.detectChanges();
    expect(page.form.controls.programId.value).toBe('');
    expect(page.form.controls.programId.hasError('required')).toBe(true);
  });

  it('confirms before sending, prevents duplicate submissions, and preserves details after failure', () => {
    const response = new Subject<never>();
    submit.mockReturnValue(response);
    create(); fill(); page.submit();
    expect(page.showConfirmModal()).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    page.confirmSubmission(); page.confirmSubmission();
    expect(submit).toHaveBeenCalledTimes(1);
    response.error({ status: 503 });
    expect(page.showSubmissionError()).toBe(true);
    expect(page.form.controls.fullName.value).toBe('Test Applicant');
    expect(page.selectedPositions()).toEqual([{ positionId: 'writer', categories: ['News'] }]);
  });

  it('recovers from unavailable colleges without losing the form', () => {
    getColleges.mockReturnValueOnce(throwError(() => new Error('Offline')));
    create();
    page.form.controls.fullName.setValue('Test Applicant');
    expect(page.collegeError()).toBe(true);
    page.retryColleges(); fixture.detectChanges();
    expect(page.collegeError()).toBe(false);
    expect(page.colleges()).toHaveLength(2);
    expect(page.form.controls.fullName.value).toBe('Test Applicant');
  });

  it('rejects unknown role links and refreshes settings when recruitment closes during submission', () => {
    submit.mockReturnValue(throwError(() => ({ status: 403, error: { error: 'Recruitment has closed.' } })));
    create();
    fixture.componentRef.setInput('preselectedPosition', 'unknown'); fixture.detectChanges();
    expect(page.selectedPositions()).toEqual([]);
    fixture.componentRef.setInput('preselectedPosition', 'writer'); fixture.detectChanges();
    expect(page.selectedPositions()[0].positionId).toBe('writer');
    page.togglePosition('writer'); fill(); page.confirmSubmission();
    expect(page.submissionErrorTitle()).toBe('Applications Are Closed');
    expect(refreshApplicationSettings).toHaveBeenCalledOnce();
    expect(page.form.controls.email.value).toBe('test@example.com');
  });
});
