import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { combineLatest, map, of, switchMap, finalize } from 'rxjs';

import { ViewMemberInfoModalComponent } from '../../../../shared/components/view-member-info-modal/view-member-info-modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { ApplicationService } from '../../../../core/services/application.service';
import { EditorialBoardService } from '../../../../core/services/editorial-board.service';
import { StaffService } from '../../../../core/services/staff.service';
import { CollegeService } from '../../../join/services/college.service';
import { College, Program } from '../../../join/models/college.model';
import { Application } from '../../../../models/application.model';
import { BoardMember, ApiBoard } from '../../../../models/editorial-board.model';
import { StaffMember } from '../../../../models/staff-member.model';

@Component({
  selector: 'admin-editorial-staff',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ViewMemberInfoModalComponent, ConfirmationModal],
  templateUrl: './staff-directory.html',
})
export class StaffDirectoryComponent implements OnInit {

  private applicationService = inject(ApplicationService);
  private editorialBoardService = inject(EditorialBoardService);
  private staffService = inject(StaffService);
  private collegeService = inject(CollegeService);
  private fb = inject(FormBuilder);

  colleges = signal<College[]>([]);

  applications$ = this.applicationService.applications$;
  board$ = this.editorialBoardService.board$;
  boardLoaded$ = this.editorialBoardService.boardLoaded$;
  hasActiveBoard$ = this.editorialBoardService.hasActiveBoard$;

  /**
   * Staff members eligible and available for the current board.
   * Rules enforced on both layers:
   *   – Backend: /api/staff/eligible-for-board already excludes 4th-year staff.
   *   – Frontend guard: additionally filters out 4th_year in case the cache is stale.
   *   – Members who already hold their maximum 2 board positions are excluded.
   *   – When the board is marked satisfied (persisted in DB), members with exactly
   *     1 assignment are also hidden so the panel stays clean.
   */
  availableForAssignment$ = combineLatest([
    this.editorialBoardService.board$,
    this.staffService.staff$,
    this.editorialBoardService.boardSatisfied$,
  ]).pipe(
    map(([board, staff, satisfied]) => {
      // Count active board assignments per staff member (by id, fall back to name)
      const countById  = new Map<string, number>();
      const countByName = new Map<string, number>();
      board.sections.forEach((s: { members: BoardMember[] }) =>
        s.members.forEach((m: BoardMember) => {
          const key = m.name.trim().toLowerCase();
          countByName.set(key, (countByName.get(key) ?? 0) + 1);
          if (m.staffId) countById.set(m.staffId, (countById.get(m.staffId) ?? 0) + 1);
        })
      );
      return (staff as StaffMember[]).filter((s: StaffMember) => {
        const n = countById.get(s.id) ?? countByName.get(s.fullName.trim().toLowerCase()) ?? 0;
        // 4th-year staff cannot be freshly assigned to a board (n === 0).
        // However, if they already hold 1 position on the current board (n >= 1),
        // they are still eligible for their 2nd slot.
        if (s.yearLevel === '4th_year' && n === 0) return false;
        // Each staff member may hold up to 2 board positions.
        // When board is "satisfied", hide those who already have 1 assignment.
        return satisfied ? n === 0 : n < 2;
      });
    })
  );

  ngOnInit(): void {
    // Clear hardcoded initial data, then load real board from DB.
    this.editorialBoardService.loadActiveBoard().subscribe(() => {
      this.currentSectionIndex = 0;
      // Refresh eligible staff so the available panel reflects the current board state
      this.staffService.refresh();
    });
    this.loadAllBoards();
    this.collegeService.getColleges().subscribe({
      next: (colleges) => {
        this.colleges.set(colleges ?? []);
      },
      error: () => this.colleges.set([]),
    });
  }

  // =========================
  // Board Satisfied
  // =========================

  /** Whether a satisfy/unsatisfy API call is in progress. */
  satisfyingBoard = signal(false);

  get isBoardSatisfied(): boolean {
    return this.editorialBoardService.isBoardSatisfied;
  }

  toggleBoardSatisfied(): void {
    if (this.satisfyingBoard()) return;
    const next = !this.editorialBoardService.isBoardSatisfied;
    this.satisfyingBoard.set(true);
    this.editorialBoardService.satisfyBoard(next).subscribe({
      next: () => this.satisfyingBoard.set(false),
      error: () => this.satisfyingBoard.set(false),
    });
  }

  // =========================
  // Board Switcher
  // =========================

  allBoards = signal<ApiBoard[]>([]);
  switchingBoardId = signal<string | null>(null);
  boardSwitchError = signal<string | null>(null);

  loadAllBoards(): void {
    this.editorialBoardService.getAllBoards().subscribe({
      next: boards => { this.allBoards.set(boards); },
      error: () => {},
    });
  }

  switchToBoard(board: ApiBoard): void {
    if (board.isActive || this.switchingBoardId()) return;
    this.switchingBoardId.set(board.id);
    this.boardSwitchError.set(null);
    this.editorialBoardService.activateBoard(board.id).subscribe({
      next: () => {
        // Update local list to reflect new active state
        this.allBoards.update(bs => bs.map(b => ({ ...b, isActive: b.id === board.id })));
        this.switchingBoardId.set(null);
        this.currentSectionIndex = 0;
        // Refresh eligible staff for the newly activated board
        this.staffService.refresh();
      },
      error: () => {
        this.switchingBoardId.set(null);
        this.boardSwitchError.set('Failed to switch board. Please try again.');
      },
    });
  }

  deletingBoardId = signal<string | null>(null);
  boardDeleteError = signal<string | null>(null);
  boardToDelete = signal<ApiBoard | null>(null);
  showDeleteBoardConfirm = signal(false);
  deleteBoardMessage = signal('');

  deleteBoard(board: ApiBoard, event: Event): void {
    event.stopPropagation();
    if (board.isActive || this.deletingBoardId()) return;
    this.boardToDelete.set(board);
    this.deleteBoardMessage.set(`Are you sure you want to delete the board for ${board.academicYear}? This cannot be undone.`);
    this.showDeleteBoardConfirm.set(true);
  }

  confirmDeleteBoard(): void {
    const board = this.boardToDelete();
    if (!board) return;
    this.showDeleteBoardConfirm.set(false);
    this.deletingBoardId.set(board.id);
    this.boardDeleteError.set(null);
    this.editorialBoardService.deleteBoard(board.id).subscribe({
      next: () => {
        this.allBoards.update(bs => bs.filter(b => b.id !== board.id));
        this.deletingBoardId.set(null);
        this.boardToDelete.set(null);
      },
      error: () => {
        this.deletingBoardId.set(null);
        this.boardDeleteError.set('Failed to delete board. Please try again.');
      },
    });
  }

  cancelDeleteBoard(): void {
    this.showDeleteBoardConfirm.set(false);
    this.boardToDelete.set(null);
  }

  // =========================
  // New Board Modal
  // =========================

  showNewBoardModal = signal(false);
  newBoardError = signal<string | null>(null);
  newBoardSubmitting = signal(false);

  newBoardForm: FormGroup = this.fb.group({
    academicYear: ['', [Validators.required, this.academicYearValidator()]],
    adviserName:  ['', [Validators.required, Validators.minLength(2)]],
  });

  /** Validates YYYY-YYYY or YYYY–YYYY format with exactly one-year gap. */
  private academicYearValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const val = (control.value as string)?.trim();
      if (!val) return null; // required handles empty
      const match = val.match(/^(\d{4})[\u2013-](\d{4})$/);
      if (!match) return { invalidFormat: true };
      const start = parseInt(match[1], 10);
      const end   = parseInt(match[2], 10);
      if (end !== start + 1) return { invalidGap: true };
      return null;
    };
  }

  openNewBoardModal() {
    this.newBoardForm.reset();
    this.newBoardError.set(null);
    this.showNewBoardModal.set(true);
  }

  closeNewBoardModal() {
    this.showNewBoardModal.set(false);
    this.newBoardError.set(null);
  }

  submitNewBoard() {
    if (this.newBoardForm.invalid || this.newBoardSubmitting()) return;
    const { academicYear, adviserName } = this.newBoardForm.value as { academicYear: string; adviserName: string };

    // Duplicate check on the client side
    const duplicate = this.allBoards().some(
      b => b.academicYear.replace(/\u2013/g, '-').trim().toLowerCase()
        === academicYear.replace(/\u2013/g, '-').trim().toLowerCase()
    );
    if (duplicate) {
      this.newBoardError.set(`A board for "${academicYear.trim()}" already exists.`);
      return;
    }

    this.newBoardSubmitting.set(true);
    this.editorialBoardService.createBoard(academicYear.trim(), adviserName.trim()).subscribe({
      next: (newBoard) => {
        this.newBoardSubmitting.set(false);
        this.closeNewBoardModal();
        // Prepend the new board (backend orders by created_at DESC)
        this.allBoards.update(bs => [newBoard, ...bs]);
      },
      error: (err) => {
        this.newBoardSubmitting.set(false);
        const msg = err?.error?.error as string | undefined;
        this.newBoardError.set(msg?.includes('already exists')
          ? `A board for "${academicYear.trim()}" already exists.`
          : 'Failed to create board. Please try again.');
      }
    });
  }

  // =========================
  // Position ID → Display Label
  // =========================

  readonly POSITION_LABELS: Record<string, string> = {
    'writer':     'Staff Writer',
    'multimedia': 'Multimedia Producer',
    'creative':   'Creative Producer',
    'broadcast':  'Broadcaster',
  };

  readonly POSITION_OPTIONS: Array<{ id: string; label: string }> = [
    { id: 'writer', label: 'Staff Writer' },
    { id: 'multimedia', label: 'Multimedia Producer' },
    { id: 'creative', label: 'Creative Producer' },
    { id: 'broadcast', label: 'Broadcaster' },
  ];

  readonly SUB_ROLE_OPTIONS: Record<string, string[]> = {
    writer: ['News', 'Sports', 'Feature', 'Column', 'Editorial', 'DevCom', 'Literary'],
    multimedia: ['Photojournalist', 'Video Journalist'],
    creative: ['Cartoonist', 'Layout Artist'],
    broadcast: ['News Anchor', 'Field Reporter', 'Mobile Journalist'],
  };

  positionLabel(positionId: string): string {
    return this.POSITION_LABELS[positionId] ?? positionId;
  }

  // =========================
  // Year Level → Display Label
  // =========================

  readonly YEAR_LEVEL_LABELS: Record<string, string> = {
    '1st_year':    '1st Year',
    '2nd_year':    '2nd Year',
    '3rd_year':    '3rd Year',
    '4th_year':    '4th Year',
    'unspecified': '—',
  };

  getYearLevelLabel(value: string | undefined): string {
    if (!value) return '—';
    return this.YEAR_LEVEL_LABELS[value] ?? value;
  }

  // =========================
  // View Member Modal
  // =========================

  viewingMember: { member: BoardMember; sectionTitle: string } | null = null;

  openViewModal(member: BoardMember, sectionTitle: string) {
    this.viewingMember = { member, sectionTitle };
  }

  closeViewModal() {
    this.viewingMember = null;
  }

  handleViewEdit() {
    if (!this.viewingMember) return;
    const { member, sectionTitle } = this.viewingMember;
    this.closeViewModal();
    this.openEditModal(member, sectionTitle);
  }

  // =========================
  // Section → Roles Map
  // =========================

  readonly BOARD_SECTION_ROLES: Record<string, string[]> = {
    'Executive Editors': [
      'Senior Editor-In-Chief',
      'Junior Editor-In-Chief',
      'Associate Editor (Print)',
      'Associate Editor (Online)',
      'Associate Editor (Broadcast)',
      'Managing Editor',
    ],
    'Section Editors': [
      'News Editor',
      'Column Editor',
      'DevCom Editor',
      'Feature Editor',
      'Sports Editor',
      'Literary Editor',
    ],
    'Staff Writers': [
      'News Writer',
      'Column Writer',
      'Feature Writer',
      'DevCom Writer',
      'Sports Writer',
      'Literary Writer',
    ],
    'Senior Creative Producers': [
      'Cartoonist',
      'Photojournalist',
      'Video Journalist',
      'Layout Artist',
    ],
    'Junior Creative Producers': [
      'Cartoonist',
      'Contributor',
      'Photojournalist',
      'Video Journalist',
      'Layout Artist',
    ],
    'Broadcasters': [
      'Senior Broadcaster',
      'Junior Broadcaster',
    ],
  };

  readonly boardSections = Object.keys(this.BOARD_SECTION_ROLES);

  get availableRoles(): string[] {
    const section = this.assignForm.get('section')?.value as string;
    return this.BOARD_SECTION_ROLES[section] ?? [];
  }

  // =========================
  // Section Carousel
  // =========================

  currentSectionIndex = 0;

  prevSection(total: number) {
    this.currentSectionIndex = (this.currentSectionIndex - 1 + total) % total;
  }

  nextSection(total: number) {
    this.currentSectionIndex = (this.currentSectionIndex + 1) % total;
  }

  // =========================
  // Modal State
  // =========================

  pendingApp: Application | null = null;

  assignForm: FormGroup = this.fb.group({
    section: ['', [Validators.required, Validators.minLength(2)]],
    role:    ['', [Validators.required, Validators.minLength(2)]],
  });

  // =========================
  // Autocomplete State
  // =========================

  sectionSuggestions: string[] = [];
  showSectionDropdown = false;

  roleSuggestions: string[] = [];
  showRoleDropdown = false;

  // =========================
  // Open / Close Modal
  // =========================

  openAssignModal(app: Application) {
    this.pendingApp = app;
    this.assignForm.reset();
    this.sectionSuggestions = [];
    this.roleSuggestions = [];
    this.showSectionDropdown = false;
    this.showRoleDropdown = false;
  }

  closeAssignModal() {
    this.pendingApp = null;
    this.assignForm.reset();
    this.showSectionDropdown = false;
    this.showRoleDropdown = false;
  }

  // =========================
  // Section Autocomplete
  // =========================

  onSectionFocus() {
    const val = (this.assignForm.get('section')?.value as string) ?? '';
    this.sectionSuggestions = this.filterAssignSections(val);
    this.showSectionDropdown = true;
  }

  onSectionSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.assignForm.get('section')?.setValue(val, { emitEvent: false });
    this.sectionSuggestions = this.filterAssignSections(val);
    this.showSectionDropdown = true;
    // reset role when section changes
    this.assignForm.get('role')?.reset();
    this.roleSuggestions = [];
  }

  selectSection(section: string) {
    this.assignForm.get('section')?.setValue(section);
    this.assignForm.get('role')?.reset();
    this.roleSuggestions = [];
    this.showSectionDropdown = false;
  }

  hideSectionDropdown() {
    setTimeout(() => { this.showSectionDropdown = false; }, 150);
  }

  private filterSections(query: string): string[] {
    const q = query.toLowerCase().trim();
    if (!q) return this.boardSections;
    return this.boardSections.filter(s => s.toLowerCase().includes(q));
  }

  /** Same as filterSections but excludes sections that have no available slots (e.g. fully-filled Executive Editors). */
  private filterAssignSections(query: string): string[] {
    const available = this.boardSections.filter(s =>
      !(s === 'Executive Editors' && this.isExecEditorsFull)
    );
    const q = query.toLowerCase().trim();
    if (!q) return available;
    return available.filter(s => s.toLowerCase().includes(q));
  }

  // =========================
  // Role Autocomplete
  // =========================

  onRoleFocus() {
    const val = (this.assignForm.get('role')?.value as string) ?? '';
    this.roleSuggestions = this.filterRoles(val);
    this.showRoleDropdown = true;
  }

  onRoleSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.assignForm.get('role')?.setValue(val, { emitEvent: false });
    this.roleSuggestions = this.filterRoles(val);
    this.showRoleDropdown = true;
  }

  selectRole(role: string) {
    this.assignForm.get('role')?.setValue(role);
    this.showRoleDropdown = false;
  }

  hideRoleDropdown() {
    setTimeout(() => { this.showRoleDropdown = false; }, 150);
  }

  private filterRoles(query: string): string[] {
    const roles = this.availableRoles;
    const q = query.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(r => r.toLowerCase().includes(q));
  }

  // =========================
  // Edit Role Modal
  // =========================

  editingMember: { member: BoardMember; sectionTitle: string } | null = null;

  editForm: FormGroup = this.fb.group({
    section: ['', [Validators.required, Validators.minLength(2)]],
    role:    ['', [Validators.required, Validators.minLength(2)]],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    studentId: [''],
    yearLevel: [''],
    collegeId: [''],
    programId: [''],
    positionId: [''],
    subRole: [''],
  });

  editSubmitting = false;
  editSubmitError: string | null = null;

  editSectionSuggestions: string[] = [];
  showEditSectionDropdown = false;

  editRoleSuggestions: string[] = [];
  showEditRoleDropdown = false;

  get editAvailableRoles(): string[] {
    const section = this.editForm.get('section')?.value as string;
    return this.BOARD_SECTION_ROLES[section] ?? [];
  }

  openEditModal(member: BoardMember, sectionTitle: string) {
    const staffRecord = member.staffId ? this.staffService.getAll().find((s) => s.id === member.staffId) : undefined;
    this.editingMember = { member, sectionTitle };
    this.editForm.reset({
      section: sectionTitle,
      role: member.position,
      fullName: staffRecord?.fullName ?? member.name ?? '',
      email: staffRecord?.email ?? '',
      studentId: staffRecord?.studentId ?? '',
      yearLevel: staffRecord?.yearLevel ?? '',
      collegeId: staffRecord?.collegeId ?? '',
      programId: staffRecord?.programId ?? '',
      positionId: staffRecord?.positionId ?? '',
      subRole: staffRecord?.subRole ?? '',
    });
    this.editSectionSuggestions = [];
    this.editRoleSuggestions = [];
    this.showEditSectionDropdown = false;
    this.showEditRoleDropdown = false;
    this.editSubmitting = false;
    this.editSubmitError = null;
  }

  // =========================
  // Edit Modal: College/Program dropdowns
  // =========================

  get editProgramOptions(): Program[] {
    const collegeId = String(this.editForm.get('collegeId')?.value ?? '').trim();
    if (!collegeId) return [];
    const college = this.colleges().find((c) => c.id === collegeId);
    return college?.programs ?? [];
  }

  onEditCollegeChange(event: Event) {
    const nextCollegeId = String((event.target as HTMLSelectElement).value ?? '').trim();
    const prevCollegeId = String(this.editForm.get('collegeId')?.value ?? '').trim();
    this.editForm.get('collegeId')?.setValue(nextCollegeId, { emitEvent: false });

    // When college changes, reset program selection so it stays consistent.
    if (prevCollegeId !== nextCollegeId) {
      this.editForm.get('programId')?.setValue('', { emitEvent: false });
    }
  }

  get editSubRoleOptions(): string[] {
    const positionId = String(this.editForm.get('positionId')?.value ?? '').trim();
    return this.SUB_ROLE_OPTIONS[positionId] ?? [];
  }

  onEditPositionChange(event: Event) {
    const nextPositionId = String((event.target as HTMLSelectElement).value ?? '').trim();
    const prevPositionId = String(this.editForm.get('positionId')?.value ?? '').trim();

    this.editForm.get('positionId')?.setValue(nextPositionId, { emitEvent: false });

    if (prevPositionId !== nextPositionId) {
      this.editForm.get('subRole')?.setValue('', { emitEvent: false });
    }
  }

  closeEditModal() {
    this.editingMember = null;
    this.editForm.reset();
    this.showEditSectionDropdown = false;
    this.showEditRoleDropdown = false;
    this.editSubmitting = false;
    this.editSubmitError = null;
  }

  submitEdit() {
    if (this.editSubmitting) return;
    if (this.editForm.invalid || !this.editingMember || this.editRoleConflict) return;

      const {
        section,
        role,
        fullName,
        email,
        studentId,
        yearLevel,
        collegeId,
        programId,
        positionId,
        subRole,
      } = this.editForm.value as {
        section: string;
        role: string;
        fullName: string;
        email: string;
        studentId?: string;
        yearLevel?: string;
        collegeId?: string;
        programId?: string;
        positionId?: string;
        subRole?: string;
      };

    const nextSection = section.trim();
    const nextRole = role.trim();
    const nextFullName = String(fullName ?? '').trim();
    const nextEmail = String(email ?? '').trim();

    const editing = this.editingMember;
    const boardId = this.editorialBoardService.activeBoardId;
    const boardMemberId = editing.member.boardMemberId;
    const staffId = editing.member.staffId;

    if (!boardId || !boardMemberId || !staffId) {
      this.editSubmitError = 'This staff member is missing a database link. Please refresh and try again.';
      return;
    }

    this.editSubmitting = true;
    this.editSubmitError = null;

    const boardUpdate$ = this.editorialBoardService.updateMemberOnBoard(
      boardId,
      boardMemberId,
      nextSection,
      nextRole
    );

    boardUpdate$
      .pipe(
        switchMap(() => {
          // Update the in-memory board immediately so UI stays responsive.
          this.editorialBoardService.updateMember(
            editing.sectionTitle,
            editing.member.name,
            nextSection,
            nextRole
          );

          const toNull = (v: unknown) => {
            const s = String(v ?? '').trim();
            return s ? s : null;
          };

          return this.staffService.update(staffId, {
            fullName: nextFullName,
            email: nextEmail,
            studentId: toNull(studentId),
            yearLevel: toNull(yearLevel),
            collegeId: toNull(collegeId),
            programId: toNull(programId),
            positionId: toNull(positionId),
            subRole: toNull(subRole),
            assignedSection: nextSection,
            assignedRole: nextRole,
          });
        }),
        finalize(() => {
          this.editSubmitting = false;
        })
      )
      .subscribe({
        next: (updatedStaff) => {
          if (staffId && updatedStaff) {
            this.editorialBoardService.patchMembersByStaffId(staffId, {
              name: updatedStaff.fullName,
              initials: this.generateInitials(updatedStaff.fullName),
              yearLevel: updatedStaff.yearLevel,
            });
          }
          this.closeEditModal();
        },
        error: () => {
          this.editSubmitError = 'Failed to update staff member. Please try again.';
        },
      });
  }

  onEditSectionFocus() {
    const val = (this.editForm.get('section')?.value as string) ?? '';
    this.editSectionSuggestions = this.filterSections(val);
    this.showEditSectionDropdown = true;
  }

  onEditSectionSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.editForm.get('section')?.setValue(val, { emitEvent: false });
    this.editSectionSuggestions = this.filterSections(val);
    this.showEditSectionDropdown = true;
    this.editForm.get('role')?.reset();
    this.editRoleSuggestions = [];
  }

  selectEditSection(section: string) {
    this.editForm.get('section')?.setValue(section);
    this.editForm.get('role')?.reset();
    this.editRoleSuggestions = [];
    this.showEditSectionDropdown = false;
  }

  hideEditSectionDropdown() {
    setTimeout(() => { this.showEditSectionDropdown = false; }, 150);
  }

  onEditRoleFocus() {
    const val = (this.editForm.get('role')?.value as string) ?? '';
    this.editRoleSuggestions = this.filterEditRoles(val);
    this.showEditRoleDropdown = true;
  }

  onEditRoleSearch(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.editForm.get('role')?.setValue(val, { emitEvent: false });
    this.editRoleSuggestions = this.filterEditRoles(val);
    this.showEditRoleDropdown = true;
  }

  selectEditRole(role: string) {
    this.editForm.get('role')?.setValue(role);
    this.showEditRoleDropdown = false;
  }

  hideEditRoleDropdown() {
    setTimeout(() => { this.showEditRoleDropdown = false; }, 150);
  }

  private filterEditRoles(query: string): string[] {
    const roles = this.editAvailableRoles;
    const q = query.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(r => r.toLowerCase().includes(q));
  }

  // =========================
  // Edit Role Conflict
  // =========================

  get editRoleConflict(): string | null {
    if (!this.editingMember) return null;
    const section = this.editForm.get('section')?.value as string;
    const role = this.editForm.get('role')?.value as string;
    if (!section || !role) return null;
    if (section === 'Executive Editors' && this.SINGLE_PERSON_EXEC_ROLES.has(role)) {
      const exec = this.editorialBoardService.getCurrentBoard().sections
        .find(s => s.title === 'Executive Editors');
      const takenByOther = exec?.members.some(
        m => m.position === role && m.name !== this.editingMember!.member.name
      );
      if (takenByOther) {
        return `"${role}" is already assigned. Each Executive Editor role can only be held by one person.`;
      }
    }
    return null;
  }

  isEditRoleTakenInDropdown(role: string): boolean {
    if (!this.editingMember) return false;
    const section = this.editForm.get('section')?.value as string;
    if (section !== 'Executive Editors' || !this.SINGLE_PERSON_EXEC_ROLES.has(role)) return false;
    const exec = this.editorialBoardService.getCurrentBoard().sections
      .find(s => s.title === 'Executive Editors');
    return !!(exec?.members.find(
      m => m.position === role && m.name !== this.editingMember!.member.name
    ));
  }

  // =========================
  // Assign Unassigned Staff to Board
  // =========================

  assigningStaff: StaffMember | null = null;

  assignStaffForm: FormGroup = this.fb.group({
    section: ['', [Validators.required, Validators.minLength(2)]],
    role:    ['', [Validators.required, Validators.minLength(2)]],
  });

  assignStaffSectionSuggestions: string[] = [];
  showAssignStaffSectionDropdown = false;

  assignStaffRoleSuggestions: string[] = [];
  showAssignStaffRoleDropdown = false;

  get assignStaffAvailableRoles(): string[] {
    const section = this.assignStaffForm.get('section')?.value as string;
    return this.BOARD_SECTION_ROLES[section] ?? [];
  }

  get assignStaffRoleConflict(): string | null {
    const section = this.assignStaffForm.get('section')?.value as string;
    const role    = this.assignStaffForm.get('role')?.value as string;
    if (!section || !role) return null;
    if (section === 'Executive Editors'
        && this.SINGLE_PERSON_EXEC_ROLES.has(role)
        && this.takenExecRoles.has(role)) {
      return `"${role}" is already assigned. Each Executive Editor role can only be held by one person.`;
    }
    return null;
  }

  isAssignStaffRoleTakenInDropdown(role: string): boolean {
    const section = this.assignStaffForm.get('section')?.value as string;
    return section === 'Executive Editors'
      && this.SINGLE_PERSON_EXEC_ROLES.has(role)
      && this.takenExecRoles.has(role);
  }

  /** Returns the sections+roles the given staff member is currently assigned to on the active board. */
  getCurrentBoardAssignments(staffId: string, fullName: string): { section: string; role: string }[] {
    const board = this.editorialBoardService.getCurrentBoard();
    const nameLc = fullName.trim().toLowerCase();
    const result: { section: string; role: string }[] = [];
    board.sections.forEach(s =>
      s.members.forEach(m => {
        if ((m.staffId && m.staffId === staffId) || m.name.trim().toLowerCase() === nameLc)
          result.push({ section: s.title, role: m.position });
      })
    );
    return result;
  }

  get assignStaffSectionConflict(): string | null {
    if (!this.assigningStaff) return null;
    const section = this.assignStaffForm.get('section')?.value as string;
    if (!section) return null;
    const current = this.getCurrentBoardAssignments(this.assigningStaff.id, this.assigningStaff.fullName);
    if (current.length >= 2)
      return `${this.assigningStaff.fullName} already holds 2 board positions (the maximum).`;
    if (current.some(a => a.section === section))
      return `${this.assigningStaff.fullName} is already assigned to ${section}.`;
    if (section === 'Executive Editors' && this.isExecEditorsFull)
      return 'All Executive Editor positions are currently filled.';
    return null;
  }

  openAssignStaffModal(staff: StaffMember): void {
    this.assigningStaff = staff;
    const current = this.getCurrentBoardAssignments(staff.id, staff.fullName);
    // Pre-fill previous section/role only when they have no active board assignments
    this.assignStaffForm.reset({
      section: current.length === 0 ? (staff.assignedSection ?? '') : '',
      role:    current.length === 0 ? (staff.assignedRole    ?? '') : '',
    });
    this.assignStaffSectionSuggestions = [];
    this.assignStaffRoleSuggestions = [];
    this.showAssignStaffSectionDropdown = false;
    this.showAssignStaffRoleDropdown = false;
  }

  closeAssignStaffModal(): void {
    this.assigningStaff = null;
    this.assignStaffForm.reset();
    this.showAssignStaffSectionDropdown = false;
    this.showAssignStaffRoleDropdown = false;
  }

  onAssignStaffSectionFocus(): void {
    const val = (this.assignStaffForm.get('section')?.value as string) ?? '';
    this.assignStaffSectionSuggestions = this.filterAssignSections(val);
    this.showAssignStaffSectionDropdown = true;
  }

  onAssignStaffSectionSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.assignStaffForm.get('section')?.setValue(val, { emitEvent: false });
    this.assignStaffSectionSuggestions = this.filterAssignSections(val);
    this.showAssignStaffSectionDropdown = true;
    this.assignStaffForm.get('role')?.reset();
    this.assignStaffRoleSuggestions = [];
  }

  selectAssignStaffSection(section: string): void {
    this.assignStaffForm.get('section')?.setValue(section);
    this.assignStaffForm.get('role')?.reset();
    this.assignStaffRoleSuggestions = [];
    this.showAssignStaffSectionDropdown = false;
  }

  hideAssignStaffSectionDropdown(): void {
    setTimeout(() => { this.showAssignStaffSectionDropdown = false; }, 150);
  }

  onAssignStaffRoleFocus(): void {
    const val = (this.assignStaffForm.get('role')?.value as string) ?? '';
    this.assignStaffRoleSuggestions = this.filterAssignStaffRoles(val);
    this.showAssignStaffRoleDropdown = true;
  }

  onAssignStaffRoleSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.assignStaffForm.get('role')?.setValue(val, { emitEvent: false });
    this.assignStaffRoleSuggestions = this.filterAssignStaffRoles(val);
    this.showAssignStaffRoleDropdown = true;
  }

  selectAssignStaffRole(role: string): void {
    this.assignStaffForm.get('role')?.setValue(role);
    this.showAssignStaffRoleDropdown = false;
  }

  hideAssignStaffRoleDropdown(): void {
    setTimeout(() => { this.showAssignStaffRoleDropdown = false; }, 150);
  }

  private filterAssignStaffRoles(query: string): string[] {
    const roles = this.assignStaffAvailableRoles;
    const q = query.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(r => r.toLowerCase().includes(q));
  }

  submitAssignStaff(): void {
    if (this.assignStaffForm.invalid || !this.assigningStaff ||
        this.assignStaffRoleConflict || this.assignStaffSectionConflict) return;
    const { section, role } = this.assignStaffForm.value as { section: string; role: string };
    const staff = this.assigningStaff;
    const member: BoardMember = {
      name: staff.fullName,
      position: role.trim(),
      initials: this.generateInitials(staff.fullName),
      staffId: staff.id,
    };
    this.editorialBoardService.addMember(section.trim(), member);
    this.editorialBoardService.addMemberToBoard(staff.id, section.trim(), role.trim())
      .subscribe({
        next: (boardMember) => {
          this.editorialBoardService.patchMemberBoardId(section.trim(), staff.fullName, boardMember.id, staff.id);
        },
        error: err => console.error('Failed to add board member:', err)
      });
    this.closeAssignStaffModal();
  }

  // =========================
  // Revoke Acceptance
  // =========================

  revokingApp: Application | null = null;

  openRevokeModal(app: Application) {
    this.revokingApp = app;
  }

  closeRevokeModal() {
    this.revokingApp = null;
  }

  confirmRevoke() {
    if (!this.revokingApp) return;
    this.applicationService.revokeAcceptance(this.revokingApp.id!);
    this.closeRevokeModal();
  }

  // =========================
  // Exec Role Validation
  // =========================

  private readonly SINGLE_PERSON_EXEC_ROLES = new Set([
    'Senior Editor-In-Chief',
    'Junior Editor-In-Chief',
    'Associate Editor (Print)',
    'Associate Editor (Online)',
    'Associate Editor (Broadcast)',
    'Managing Editor',
  ]);

  get takenExecRoles(): Set<string> {
    const exec = this.editorialBoardService.getCurrentBoard().sections
      .find(s => s.title === 'Executive Editors');
    return new Set(exec?.members.map(m => m.position) ?? []);
  }

  get isExecEditorsFull(): boolean {
    const execRoles = this.BOARD_SECTION_ROLES['Executive Editors'] ?? [];
    return execRoles.every(role => this.takenExecRoles.has(role));
  }

  isRoleTakenInDropdown(role: string): boolean {
    const section = this.assignForm.get('section')?.value as string;
    return section === 'Executive Editors'
      && this.SINGLE_PERSON_EXEC_ROLES.has(role)
      && this.takenExecRoles.has(role);
  }

  get assignRoleConflict(): string | null {
    const section = this.assignForm.get('section')?.value as string;
    const role = this.assignForm.get('role')?.value as string;
    if (!section || !role) return null;
    if (section === 'Executive Editors'
        && this.SINGLE_PERSON_EXEC_ROLES.has(role)
        && this.takenExecRoles.has(role)) {
      return `"${role}" is already assigned. Each Executive Editor role can only be held by one person.`;
    }
    return null;
  }

  // =========================
  // Remove Member
  // =========================

  deletingMember: { member: BoardMember; sectionTitle: string } | null = null;
  deleteError: string | null = null;

  openDeleteModal(member: BoardMember, sectionTitle: string) {
    this.deletingMember = { member, sectionTitle };
    this.deleteError = null;
  }

  closeDeleteModal() {
    this.deletingMember = null;
    this.deleteError = null;
  }

  confirmDelete() {
    if (!this.deletingMember) return;
    const { member, sectionTitle } = this.deletingMember;
    const boardId = this.editorialBoardService.activeBoardId;

    // Primary path: remove only the board assignment, staff_member record is kept.
    // The person will reappear in "Staff Without Board Assignment" for re-assignment.
    if (boardId && member.boardMemberId) {
      this.editorialBoardService.removeMemberFromBoard(boardId, member.boardMemberId).subscribe({
        next: () => {
          this.editorialBoardService.removeMember(sectionTitle, member.name);
          // If the board was marked satisfied, un-satisfy it since the composition changed.
          // This ensures removed members (who now have fewer assignments) re-appear in the panel.
          if (this.editorialBoardService.isBoardSatisfied) {
            this.editorialBoardService.satisfyBoard(false).subscribe();
          }
          // Refresh eligible list so the removed member reappears in the available panel
          this.staffService.refresh();
          this.closeDeleteModal();
        },
        error: () => {
          setTimeout(() => {
            this.deleteError = 'Failed to remove staff member from board. Please try again.';
          });
        }
      });
      return;
    }

    // Fallback: boardMemberId not yet available (member was just added in this session
    // and the addMemberToBoard response hasn't returned yet).
    const staffRecord = this.staffService.getAll().find(
      s => s.fullName?.trim().toLowerCase() === member.name.trim().toLowerCase()
    );

    if (!staffRecord) {
      // No DB record at all — just clean up the in-memory display
      this.editorialBoardService.removeMember(sectionTitle, member.name);
      this.closeDeleteModal();
      return;
    }

    // Has staff record but boardMemberId not yet known — fully delete to avoid orphan DB rows
    this.staffService.delete(staffRecord.id).subscribe({
      next: () => {
        this.editorialBoardService.removeMember(sectionTitle, member.name);
        this.applicationService.refresh();
        this.closeDeleteModal();
      },
      error: () => {
        setTimeout(() => {
          this.deleteError = 'Failed to remove staff member from board. Please try again.';
        });
      }
    });
  }

  // =========================
  // Submit
  // =========================

  submitAssign() {
    if (this.assignForm.invalid || !this.pendingApp?.id) return;
    if (this.assignRoleConflict) return;

    const { section, role } = this.assignForm.value as { section: string; role: string };
    const appId = this.pendingApp.id;
    const trimmedSection = section.trim();
    const trimmedRole = role.trim();

    const member: BoardMember = {
      name: this.pendingApp.fullName,
      position: trimmedRole,
      initials: this.generateInitials(this.pendingApp.fullName),
    };

    // Update in-memory editorial board immediately for responsive UI
    this.editorialBoardService.addMember(trimmedSection, member);

    // Persist to DB: mark application as assigned + create staff_members record
    this.applicationService.markAssigned(appId, trimmedSection, trimmedRole);
    this.staffService.createFromApplication(appId, trimmedSection, trimmedRole).subscribe({
      next: (newStaff) => {
        // Also add to board_members table in DB
        this.editorialBoardService.addMemberToBoard(newStaff.id, trimmedSection, trimmedRole)
          .subscribe({
            next: (boardMember) => {
              // Patch the in-memory member with its DB id so Remove can target it precisely
              this.editorialBoardService.patchMemberBoardId(trimmedSection, member.name, boardMember.id, newStaff.id);
            },
            error: err => console.error('Failed to add board member:', err)
          });
      },
      error: err => console.error('Failed to create staff member record:', err)
    });

    this.closeAssignModal();
  }

  // =========================
  // Helper
  // =========================

  generateInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

}
