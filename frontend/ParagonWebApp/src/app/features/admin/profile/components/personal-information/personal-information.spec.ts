import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { CollegeService } from '../../../../join/services/college.service';
import { PersonalInformation } from './personal-information';
import { EditPersonalInfoModal } from './edit-personal-info-modal/edit-personal-info-modal';

describe('Profile education lookup', () => {
  afterEach(() => TestBed.resetTestingModule());
  it('retains stored identifiers on lookup failure and resolves names after retry', async () => {
    const getColleges = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 503 }))).mockReturnValueOnce(of([{ id: 'sample-college', name: 'Sample College', programs: [{ id: 'sample-program', name: 'Sample Program' }] }]));
    await TestBed.configureTestingModule({ imports: [PersonalInformation], providers: [provideRouter([]), { provide: CollegeService, useValue: { getColleges } }] }).compileComponents();
    const fixture = TestBed.createComponent(PersonalInformation);
    fixture.componentRef.setInput('staff', { id: 'sample', fullName: 'Sample Editor', email: 'sample@example.test', collegeId: 'sample-college', programId: 'sample-program', yearLevel: '2nd_year' });
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.educationError).toBe(true);
    expect(component.collegeName).toBe('sample-college');
    expect(component.programName).toBe('sample-program');
    expect(component.displayYear).toBe('2nd Year');
    component.retryEducationData();
    expect(component.educationError).toBe(false);
    expect(component.collegeName).toBe('Sample College');
    expect(component.programName).toBe('Sample Program');
    fixture.componentRef.setInput('staff', null); fixture.detectChanges();
    expect(component.staffData).toBeNull(); expect(component.collegeName).toBeNull();
    fixture.destroy();
  });

  it('keeps personal-info edits isolated until an explicit save emission', () => {
    const component = new EditPersonalInfoModal();
    component.user = { fullName: 'Sample Editor', email: 'sample@example.test' };
    component.ngOnChanges(); component.editData.fullName = 'Updated Sample';
    expect(component.user.fullName).toBe('Sample Editor');
    const save = vi.fn(); const close = vi.fn();
    component.save.subscribe(save); component.close.subscribe(close);
    component.saveChanges(); component.closeModal();
    expect(save).toHaveBeenCalledWith(component.editData); expect(close).toHaveBeenCalledOnce();
  });
});
