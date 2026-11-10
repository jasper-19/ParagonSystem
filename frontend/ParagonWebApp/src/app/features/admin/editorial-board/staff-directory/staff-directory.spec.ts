import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, firstValueFrom, of, Subject } from 'rxjs';
import { vi } from 'vitest';
import { ApplicationService } from '../../../../core/services/application.service';
import { EditorialBoardService } from '../../../../core/services/editorial-board.service';
import { StaffService } from '../../../../core/services/staff.service';
import { Application } from '../../../../models/application.model';
import { ApiBoard, EditorialBoardData } from '../../../../models/editorial-board.model';
import { StaffMember } from '../../../../models/staff-member.model';
import { CollegeService } from '../../../join/services/college.service';
import { StaffDirectoryComponent } from './staff-directory';

describe('Staff directory workflow safeguards', () => {
  const applicant: Application = { id: 'sample-applicant', fullName: 'Sample Applicant', email: 'sample@example.test', studentId: 'SAMPLE-001', yearLevel: '1st_year', collegeId: 'sample-college', programId: 'sample-program', motivation: 'Synthetic application.', status: 'accepted' };
  const board: ApiBoard = { id: 'sample-board', academicYear: '2026-2027', adviserName: 'Sample Adviser', coAdviserName: '', isActive: true, isSatisfied: false, createdAt: '2026-11-07T00:00:00Z' };
  let component: StaffDirectoryComponent;
  let data: EditorialBoardData;
  let boardChanges: BehaviorSubject<EditorialBoardData>;
  let satisfied: BehaviorSubject<boolean>;
  let staffChanges: BehaviorSubject<StaffMember[]>;
  let editorial: Record<string, any>;
  let applications: Record<string, any>;
  let staff: Record<string, any>;

  beforeEach(() => {
    data = { academicYear: board.academicYear, sections: [{ title: 'Executive Editors', members: [{ name: 'Sample Editor', staffId: 'assigned', position: 'Senior Editor-In-Chief' }] }], adviser: { name: 'Sample Adviser', position: 'Adviser' }, coAdviser: { name: '', position: 'Co-Adviser' } };
    boardChanges = new BehaviorSubject(data); satisfied = new BehaviorSubject(false); staffChanges = new BehaviorSubject<StaffMember[]>([]);
    editorial = { board$: boardChanges, boardSatisfied$: satisfied, boardLoaded$: of(true), hasActiveBoard$: of(true), allBoards$: of([board]), activeBoardId: board.id,
      getCurrentBoard: () => data, createBoard: vi.fn(), assignApplicationToBoard: vi.fn(), addMemberToBoard: vi.fn(), updateMemberOnBoard: vi.fn(() => of(undefined)) };
    applications = { applications$: of([applicant]), revokeAcceptance: vi.fn(), refresh: vi.fn() };
    staff = { staff$: staffChanges, update: vi.fn() };
    TestBed.configureTestingModule({ providers: [
      { provide: EditorialBoardService, useValue: editorial }, { provide: ApplicationService, useValue: applications },
      { provide: StaffService, useValue: staff }, { provide: CollegeService, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new StaffDirectoryComponent());
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { component.ngOnDestroy(); boardChanges.complete(); satisfied.complete(); staffChanges.complete(); TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('initializes accepted applicants with an explicit search clear', () => {
    vi.spyOn(component, 'loadActiveBoard').mockImplementation(() => {});
    vi.spyOn(component, 'loadAllBoards').mockImplementation(() => {});
    vi.spyOn(component, 'loadStaff').mockImplementation(() => {});
    vi.spyOn(component, 'loadColleges').mockImplementation(() => {});
    component.ngOnInit();
    expect(applications['refresh']).toHaveBeenCalledExactlyOnceWith(1, 100, 'accepted', undefined);
  });

  it('preserves eligibility and the two-position limit when listing staff available for assignment', async () => {
    const sample = (id: string, extra: Partial<StaffMember> = {}): StaffMember => ({ id, fullName: `Sample ${id}`, email: `${id}@example.test`, ...extra });
    staffChanges.next([sample('assigned'), sample('available'), sample('graduated', { isBoardEligible: false }), sample('two-roles')]);
    data.sections.push({ title: 'News', members: [{ name: 'Sample two-roles', staffId: 'two-roles', position: 'Writer' }, { name: 'Sample two-roles', staffId: 'two-roles', position: 'Editor' }] });
    boardChanges.next(data);
    expect((await firstValueFrom(component.availableForAssignment$)).map(staff => staff.id)).toEqual(['assigned', 'available']);
    satisfied.next(true);
    expect((await firstValueFrom(component.availableForAssignment$)).map(staff => staff.id)).toEqual(['available']);
  });

  it('validates academic years and prevents duplicate or concurrent board creation', () => {
    component.newBoardForm.setValue({ academicYear: '2026-2028', adviserName: 'Sample Adviser', coAdviserName: '' }); component.submitNewBoard();
    expect(editorial['createBoard']).not.toHaveBeenCalled();
    component.allBoards.set([board]); component.newBoardForm.patchValue({ academicYear: '2026–2027' }); component.submitNewBoard();
    expect(component.newBoardError()).toContain('already exists');
    expect(editorial['createBoard']).not.toHaveBeenCalled();
    const pending = new Subject<ApiBoard>(); editorial['createBoard'].mockReturnValue(pending);
    component.openNewBoardModal();
    component.newBoardForm.setValue({ academicYear: '2027-2028', adviserName: '  Sample Adviser  ', coAdviserName: '  Sample Co-Adviser  ' });
    component.submitNewBoard(); component.submitNewBoard(); component.closeNewBoardModal();
    expect(editorial['createBoard']).toHaveBeenCalledExactlyOnceWith('2027-2028', 'Sample Adviser', 'Sample Co-Adviser');
    expect(component.showNewBoardModal()).toBe(true);
    pending.next({ ...board, id: 'new-board', academicYear: '2027-2028' }); pending.complete();
    expect(component.newBoardSubmitting()).toBe(false);
    expect(component.showNewBoardModal()).toBe(false);
  });

  it('blocks missing boards and occupied executive roles, and preserves a failed assignment for retry', () => {
    component.pendingApp = applicant; component.assignForm.setValue({ section: 'Executive Editors', role: 'Senior Editor-In-Chief' });
    component.submitAssign(); expect(editorial['assignApplicationToBoard']).not.toHaveBeenCalled();
    component.assignForm.setValue({ section: 'News', role: 'Staff Writer' }); editorial['activeBoardId'] = null;
    component.submitAssign(); expect(component.assignSubmitError()).toContain('No active editorial board');
    editorial['activeBoardId'] = board.id;
    const pending = new Subject<void>(); editorial['assignApplicationToBoard'].mockReturnValue(pending);
    component.submitAssign(); component.submitAssign(); component.closeAssignModal();
    expect(editorial['assignApplicationToBoard']).toHaveBeenCalledExactlyOnceWith(board.id, applicant.id, 'News', 'Staff Writer');
    expect(component.pendingApp).toBe(applicant);
    pending.error({ error: { error: 'Sample assignment conflict.' } });
    expect(component.assignSubmitting()).toBe(false);
    expect(component.assignSubmitError()).toBe('Sample assignment conflict.');
    expect(component.pendingApp).toBe(applicant);
  });

  it('prevents duplicate acceptance revocation and keeps the dialog available after an error', () => {
    const pending = new Subject<Application>(); applications['revokeAcceptance'].mockReturnValue(pending);
    component.openRevokeModal(applicant); component.confirmRevoke(); component.confirmRevoke(); component.closeRevokeModal();
    expect(applications['revokeAcceptance']).toHaveBeenCalledExactlyOnceWith(applicant.id);
    expect(component.revokingApp).toBe(applicant);
    pending.error({ error: { error: 'Sample revocation failure.' } });
    expect(component.revokeAcceptanceSubmitting()).toBe(false);
    expect(component.revokeAcceptanceError()).toBe('Sample revocation failure.');
    expect(component.revokingApp).toBe(applicant);
    component.closeRevokeModal(); expect(component.revokingApp).toBeNull();
  });

  it.each(['applicant assignment', 'staff assignment', 'member edit', 'acceptance revocation'])('closes %s after success while keeping dismissal blocked during the request', workflow => {
    const pending = new Subject<any>();
    let submit: () => void;
    let close: () => void;
    let remainsOpen: () => boolean;
    let submitting: () => boolean;
    if (workflow === 'applicant assignment') {
      component.pendingApp = applicant; component.assignForm.setValue({ section: 'News', role: 'Staff Writer' });
      editorial['assignApplicationToBoard'].mockReturnValue(pending);
      submit = () => component.submitAssign(); close = () => component.closeAssignModal();
      remainsOpen = () => component.pendingApp !== null; submitting = () => component.assignSubmitting();
    } else if (workflow === 'staff assignment') {
      component.assigningStaff = { id: 'available-staff', fullName: 'Sample Staff', email: 'staff@example.test' };
      component.assignStaffForm.setValue({ section: 'News', role: 'Staff Writer' });
      editorial['addMemberToBoard'].mockReturnValue(pending);
      submit = () => component.submitAssignStaff(); close = () => component.closeAssignStaffModal();
      remainsOpen = () => component.assigningStaff !== null; submitting = () => component.assignStaffSubmitting();
    } else if (workflow === 'member edit') {
      component.editingMember = { member: { name: 'Sample Staff', position: 'Staff Writer', staffId: 'available-staff', boardMemberId: 'sample-member' }, sectionTitle: 'News' };
      component.editForm.patchValue({ section: 'News', role: 'Staff Writer', fullName: 'Sample Staff', email: 'staff@example.test' });
      staff['update'].mockReturnValue(pending);
      submit = () => component.submitEdit(); close = () => component.closeEditModal();
      remainsOpen = () => component.editingMember !== null; submitting = () => component.editSubmitting;
    } else {
      component.revokingApp = applicant; applications['revokeAcceptance'].mockReturnValue(pending);
      submit = () => component.confirmRevoke(); close = () => component.closeRevokeModal();
      remainsOpen = () => component.revokingApp !== null; submitting = () => component.revokeAcceptanceSubmitting();
    }
    submit(); expect(submitting()).toBe(true); close(); expect(remainsOpen()).toBe(true);
    pending.next({ ...applicant, status: 'interview_completed' }); pending.complete();
    expect(submitting()).toBe(false); expect(remainsOpen()).toBe(false);
  });
});
