import { Component, inject, OnInit, signal, AfterViewInit, ElementRef, HostListener, OnDestroy, ViewChild  } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { combineLatest, map, switchMap, finalize, Subscription } from 'rxjs';
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

type SelectedApplicationPosition = {
  positionId: string;
  categories: string[];
}
@Component({
  selector: 'admin-editorial-staff',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ViewMemberInfoModalComponent, ConfirmationModal],
  templateUrl: './staff-directory.html',
})
export class StaffDirectoryComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('assignDialog')
  private assignDialog?: ElementRef<HTMLElement>;

  @ViewChild('assignCloseButton')
  private assignCloseButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('assignStaffDialog')
  private assignStaffDialog?: ElementRef<HTMLElement>;

  @ViewChild('assignStaffCloseButton')
  private assignStaffCloseButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('newBoardDialog')
  private newBoardDialog?: ElementRef<HTMLElement>;

  @ViewChild('newBoardCloseButton')
  private newBoardCloseButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('editRoleDialog')
  private editRoleDialog?: ElementRef<HTMLElement>;

  @ViewChild('editRoleCloseButton')
  private editRoleCloseButton?: ElementRef<HTMLButtonElement>;


  @ViewChild('revokeAcceptanceDialog')
  private revokeAcceptanceDialog?: ElementRef<HTMLElement>;

  @ViewChild('revokeAcceptanceCloseButton')
  private revokeAcceptanceCloseButton?: ElementRef<HTMLButtonElement>;

  readonly revokeAcceptanceSubmitting = signal(false);

  readonly revokeAcceptanceError =
    signal<string | null>(null);

  private previouslyFocusedElement:
    HTMLElement | null = null;

  private viewInitialized = false;
  private previousBodyOverflow = '';
  private isBodyScrollLocked = false;

  private applicationService = inject(ApplicationService);
  private editorialBoardService = inject(EditorialBoardService);
  private staffService = inject(StaffService);
  private collegeService = inject(CollegeService);
  private fb = inject(FormBuilder);

  private sectionTouchStartX: number | null = null;
  private readonly sectionSwipeThreshold = 50;

  private allBoardsSubscription?: Subscription;

  private boardSubscription?: Subscription;

  colleges = signal<College[]>([]);

  applications$ = this.applicationService.applications$;
  board$ = this.editorialBoardService.board$;
  boardLoaded$ = this.editorialBoardService.boardLoaded$;
  hasActiveBoard$ = this.editorialBoardService.hasActiveBoard$;

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

  readonly awaitingAssignment$ =
    this.applications$.pipe(
      map(applications =>
        applications.filter(
          application =>
            application.status === 'accepted' &&
            !application.assigned
        )
      )
    );

  readonly boardLoading = signal(true);
  readonly staffLoading = signal(true);
  readonly collegesLoading = signal(true);
  readonly boardsLoading = signal(true);

  readonly boardLoadError =
    signal<string | null>(null);

  readonly staffLoadError =
    signal<string | null>(null);

  readonly collegesLoadError =
    signal<string | null>(null);

  readonly boardsLoadError =
    signal<string | null>(null);

  readonly assignSubmitting =
    signal(false);

  readonly assignSubmitError =
    signal<string | null>(null);

  readonly allBoards$ =
    this.editorialBoardService.allBoards$;

  // Assign Role modal
  activeSectionIndex = -1;
  activeRoleIndex = -1;

  // Add Staff modal
  activeAssignStaffSectionIndex = -1;
  activeAssignStaffRoleIndex = -1;

  // Edit modal
  readonly activeEditSectionIndex =
    signal(-1);

  readonly activeEditRoleIndex =
    signal(-1);

  ngOnInit(): void {
    this.loadActiveBoard();
    this.loadAllBoards();
    this.loadStaff();
    this.loadColleges();

    this.boardSubscription =
      this.board$.subscribe(board => {
        const sectionCount =
          board.sections.length;

        this.currentSectionIndex =
          sectionCount > 0
            ? Math.min(
                this.currentSectionIndex,
                sectionCount - 1
              )
            : 0;
      });

    this.allBoardsSubscription =
      this.editorialBoardService
        .allBoards$
        .subscribe(boards => {
          this.allBoards.set(boards);
        });

    this.applicationService.refresh(
      1,
      100,
      'accepted'
    );
  }

  ngAfterViewInit(): void {
    this.viewInitialized = true;

    if (this.pendingApp) {
      this.focusAssignModal();
    }
  }

  ngOnDestroy(): void {
    this.unlockBodyScroll();

    this.allBoardsSubscription
      ?.unsubscribe();

    this.boardSubscription
      ?.unsubscribe();
  }

  // Board Satisfied
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

  // Board Switcher
  allBoards = signal<ApiBoard[]>([]);
  switchingBoardId = signal<string | null>(null);
  boardSwitchError = signal<string | null>(null);

  loadAllBoards(): void {
    this.boardsLoading.set(true);
    this.boardsLoadError.set(null);

    this.editorialBoardService
      .getAllBoards()
      .pipe(
        finalize(() => {
          this.boardsLoading.set(false);
        })
      )
      .subscribe({
        next: boards => {
          this.allBoards.set(boards);
        },
        error: error => {
          console.error(
            'Failed to load all boards:',
            error
          );

          this.allBoards.set([]);
          this.boardsLoadError.set(
            'Unable to load the editorial board list.'
          );
        },
      });
  }

  loadActiveBoard(): void {
    this.boardLoading.set(true);
    this.boardLoadError.set(null);

    this.editorialBoardService
      .loadAdminActiveBoard()
      .pipe(
        finalize(() => {
          this.boardLoading.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.currentSectionIndex = 0;
        },

        error: error => {
          console.error(
            'Failed to load active board:',
            error
          );

          this.boardLoadError.set(
            'Unable to load the active editorial board.'
          );
        },
      });
  }

  loadStaff(): void {
    this.staffLoading.set(true);
    this.staffLoadError.set(null);

    this.staffService
      .loadStaff()
      .pipe(
        finalize(() => {
          this.staffLoading.set(false);
        })
      )
      .subscribe({
        error: error => {
          console.error(
            'Failed to load staff:',
            error
          );

          this.staffLoadError.set(
            'Unable to load staff members.'
          );
        },
      });
  }

  loadColleges(): void {
    this.collegesLoading.set(true);
    this.collegesLoadError.set(null);

    this.collegeService
      .getColleges()
      .pipe(
        finalize(() => {
          this.collegesLoading.set(false);
        })
      )
      .subscribe({
        next: colleges => {
          this.colleges.set(
            colleges ?? []
          );
        },
        error: error => {
          console.error(
            'Failed to load colleges:',
            error
          );

          this.colleges.set([]);
          this.collegesLoadError.set(
            'Unable to load colleges and programs.'
          );
        },
      });
  }

  switchToBoard(board: ApiBoard): void {
    if (
      board.isActive ||
      this.switchingBoardId()
    ) {
      return;
    }

    this.switchingBoardId.set(board.id);
    this.boardSwitchError.set(null);

    this.editorialBoardService
      .activateBoard(board.id)
      .pipe(
        finalize(() => {
          this.switchingBoardId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.currentSectionIndex = 0;
        },
        error: err => {
          console.error(
            'Failed to switch editorial board:',
            err
          );

          this.boardSwitchError.set(
            'Failed to switch board. Please try again.'
          );
        },
      });
  }

  onSectionCarouselKeydown(
    event: KeyboardEvent,
    total: number
  ): void {
    if (total <= 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.prevSection(total);
        break;

      case 'ArrowRight':
        event.preventDefault();
        this.nextSection(total);
        break;

      case 'Home':
        event.preventDefault();
        this.currentSectionIndex = 0;
        break;

      case 'End':
        event.preventDefault();
        this.currentSectionIndex = total - 1;
        break;

      default:
        break;
    }
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
    const board =
      this.boardToDelete();

    if (
      !board ||
      this.deletingBoardId()
    ) {
      return;
    }

    this.showDeleteBoardConfirm.set(false);
    this.deletingBoardId.set(board.id);
    this.boardDeleteError.set(null);

    this.editorialBoardService
      .deleteBoard(board.id)
      .pipe(
        finalize(() => {
          this.deletingBoardId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.boardToDelete.set(null);
        },

        error: error => {
          console.error(
            'Failed to delete editorial board:',
            error
          );

          this.boardDeleteError.set(
            error?.error?.error ??
            'Failed to delete board. Please try again.'
          );
        },
      });
  }

  cancelDeleteBoard(): void {
    if (this.deletingBoardId()) {
      return;
    }

    this.showDeleteBoardConfirm.set(false);
    this.boardToDelete.set(null);
    this.deleteBoardMessage.set('');
  }

  // New Board Modal
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

  openNewBoardModal(): void {
    this.previouslyFocusedElement =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.newBoardForm.reset();
    this.newBoardError.set(null);
    this.showNewBoardModal.set(true);

    this.lockBodyScroll();

    if (this.viewInitialized) {
      this.focusNewBoardModal();
    }
  }

  closeNewBoardModal(): void {
    if (this.newBoardSubmitting()) {
      return;
    }

    this.showNewBoardModal.set(false);
    this.newBoardError.set(null);
    this.newBoardForm.reset();

    this.unlockBodyScroll();
    this.restorePreviousFocus();
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
      next: () => {
        this.newBoardSubmitting.set(false);
        this.closeNewBoardModal();
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

  // Position ID → Display Label
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

  positionLabel(positionId?: string): string {
    if (!positionId) return '—';
    return this.POSITION_LABELS[positionId] ?? positionId;
  }

  getSelectedPositions(app: Application): SelectedApplicationPosition[] {
    if (app.selectedPositions?.length) {
      return app.selectedPositions;
    }

    if (app.positionId) {
      return [
        {
          positionId: app.positionId,
          categories: app.subRole ? [app.subRole] : [],
        },
      ];
    }

    return [];
  }

  // Year Level → Display Label
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

  // View Member Modal
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

  // Section → Roles Map
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
    const sectionValue =
      String(
        this.assignForm
          .get('section')
          ?.value ?? ''
      ).trim();

    const matchingSection =
      this.boardSections.find(
        section =>
          section.toLowerCase() ===
          sectionValue.toLowerCase()
      );

    return matchingSection
      ? this.BOARD_SECTION_ROLES[
          matchingSection
        ] ?? []
      : [];
  }

  // Section Carousel
  currentSectionIndex = 0;

  prevSection(total: number) {
    this.currentSectionIndex = (this.currentSectionIndex - 1 + total) % total;
  }

  nextSection(total: number) {
    this.currentSectionIndex = (this.currentSectionIndex + 1) % total;
  }

  // Modal State
  pendingApp: Application | null = null;

  assignForm: FormGroup = this.fb.group({
    section: ['', [Validators.required, Validators.minLength(2)]],
    role:    ['', [Validators.required, Validators.minLength(2)]],
  });

  // Autocomplete State
  sectionSuggestions: string[] = [];
  showSectionDropdown = false;

  roleSuggestions: string[] = [];
  showRoleDropdown = false;

  // Open / Close Modal
  openAssignModal(
    app: Application
  ): void {
    this.previouslyFocusedElement =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.pendingApp = app;

    this.assignForm.reset();
    this.sectionSuggestions = [];
    this.roleSuggestions = [];
    this.showSectionDropdown = false;
    this.showRoleDropdown = false;
    this.activeSectionIndex = -1;
    this.activeRoleIndex = -1;
    this.assignSubmitting.set(false);
    this.assignSubmitError.set(null);

    this.lockBodyScroll();

    if (this.viewInitialized) {
      this.focusAssignModal();
    }
  }

  closeAssignModal(): void {
    if (this.assignSubmitting()) {
      return;
    }

    this.pendingApp = null;
    this.assignForm.reset();

    this.showSectionDropdown = false;
    this.showRoleDropdown = false;
    this.activeSectionIndex = -1;
    this.activeRoleIndex = -1;
    this.assignSubmitError.set(null);

    this.unlockBodyScroll();
    this.restorePreviousFocus();
  }

  // Section Autocomplete
  onSectionFocus(): void {
    const value =
      String(
        this.assignForm
          .get('section')
          ?.value ?? ''
      );

    this.sectionSuggestions =
      this.filterAssignSections(value);

    this.activeSectionIndex =
      this.sectionSuggestions.length > 0
        ? 0
        : -1;

    this.showSectionDropdown = true;
  }

  onSectionSearch(
    event: Event
  ): void {
    const value =
      (event.target as HTMLInputElement)
        .value;

    this.assignForm
      .get('section')
      ?.setValue(value, {
        emitEvent: false,
      });

    this.sectionSuggestions =
      this.filterAssignSections(value);

    this.activeSectionIndex =
      this.sectionSuggestions.length > 0
        ? 0
        : -1;

    this.showSectionDropdown = true;

    this.assignForm
      .get('role')
      ?.reset();

    this.roleSuggestions = [];
    this.activeRoleIndex = -1;
    this.showRoleDropdown = false;
  }

  selectSection(
    section: string
  ): void {
    this.assignForm
      .get('section')
      ?.setValue(section);

    this.assignForm
      .get('role')
      ?.reset();

    this.roleSuggestions = [];
    this.activeRoleIndex = -1;
    this.showRoleDropdown = false;

    this.activeSectionIndex = -1;
    this.showSectionDropdown = false;
  }

  hideSectionDropdown(): void {
    setTimeout(() => {
      this.showSectionDropdown = false;
      this.activeSectionIndex = -1;
    }, 150);
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

  // Role Autocomplete
  private findNextEnabledRoleIndex(
    roles: string[],
    startIndex: number,
    direction: 1 | -1
  ): number {
    if (!roles.length) {
      return -1;
    }

    let index = startIndex;

    for (
      let attempts = 0;
      attempts < roles.length;
      attempts += 1
    ) {
      index =
        (
          index +
          direction +
          roles.length
        ) % roles.length;

      if (
        !this.isRoleTakenInDropdown(
          roles[index]
        )
      ) {
        return index;
      }
    }

    return -1;
  }

  onRoleFocus(): void {
    const value =
      String(
        this.assignForm
          .get('role')
          ?.value ?? ''
      );

    this.roleSuggestions =
      this.filterRoles(value);

    this.activeRoleIndex =
      this.findNextEnabledRoleIndex(
        this.roleSuggestions,
        -1,
        1
      );

    this.showRoleDropdown = true;
  }

  onRoleSearch(
    event: Event
  ): void {
    const value =
      (event.target as HTMLInputElement)
        .value;

    this.assignForm
      .get('role')
      ?.setValue(value, {
        emitEvent: false,
      });

    this.roleSuggestions =
      this.filterRoles(value);

    this.activeRoleIndex =
      this.findNextEnabledRoleIndex(
        this.roleSuggestions,
        -1,
        1
      );

    this.showRoleDropdown = true;
  }

  selectRole(
    role: string
  ): void {
    if (
      this.isRoleTakenInDropdown(role)
    ) {
      return;
    }

    this.assignForm
      .get('role')
      ?.setValue(role);

    this.activeRoleIndex = -1;
    this.showRoleDropdown = false;
  }

  hideRoleDropdown(): void {
    setTimeout(() => {
      this.showRoleDropdown = false;
      this.activeRoleIndex = -1;
    }, 150);
  }

  onAssignRoleKeydown(
    event: KeyboardEvent
  ): void {
    const roles =
      this.roleSuggestions;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (!this.showRoleDropdown) {
          this.showRoleDropdown = true;
        }

        this.activeRoleIndex =
          this.findNextEnabledRoleIndex(
            roles,
            this.activeRoleIndex,
            1
          );

        if (this.activeRoleIndex >= 0) {
          this.scrollActiveOptionIntoView(
            'assign-role-option',
            this.activeRoleIndex
          );
        }

        return;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (!this.showRoleDropdown) {
          this.showRoleDropdown = true;
        }

        this.activeRoleIndex =
          this.findNextEnabledRoleIndex(
            roles,
            this.activeRoleIndex < 0
              ? 0
              : this.activeRoleIndex,
            -1
          );

        if (this.activeRoleIndex >= 0) {
          this.scrollActiveOptionIntoView(
            'assign-role-option',
            this.activeRoleIndex
          );
        }

        return;
      }

      case 'Enter': {
        if (
          !this.showRoleDropdown ||
          this.activeRoleIndex < 0 ||
          this.activeRoleIndex >=
            roles.length
        ) {
          return;
        }

        const selectedRole =
          roles[
            this.activeRoleIndex
          ];

        if (
          this.isRoleTakenInDropdown(
            selectedRole
          )
        ) {
          return;
        }

        event.preventDefault();

        this.selectRole(
          selectedRole
        );

        return;
      }

      case 'Escape': {
        if (!this.showRoleDropdown) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showRoleDropdown = false;
        this.activeRoleIndex = -1;

        return;
      }

      case 'Tab': {
        this.showRoleDropdown = false;
        this.activeRoleIndex = -1;
        return;
      }

      default:
        return;
    }
  }

  private filterRoles(query: string): string[] {
    const roles = this.availableRoles;
    const q = query.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(r => r.toLowerCase().includes(q));
  }

  // Edit Role Modal
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
  readonly showEditSectionDropdown = signal(false);

  editRoleSuggestions: string[] = [];
  readonly showEditRoleDropdown = signal(false);

  get editAvailableRoles(): string[] {
    const section = this.editForm.get('section')?.value as string;
    return this.BOARD_SECTION_ROLES[section] ?? [];
  }

  openEditModal(
    member: BoardMember,
    sectionTitle: string
  ): void {
    this.previouslyFocusedElement =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const staffRecord =
      member.staffId
        ? this.staffService
            .getAll()
            .find(
              staff =>
                staff.id === member.staffId
            )
        : undefined;

    this.editingMember = {
      member,
      sectionTitle,
    };

    this.editForm.reset({
      section: sectionTitle,
      role: member.position,
      fullName:
        staffRecord?.fullName ??
        member.name ??
        '',
      email:
        staffRecord?.email ?? '',
      studentId:
        staffRecord?.studentId ?? '',
      yearLevel:
        staffRecord?.yearLevel ?? '',
      collegeId:
        staffRecord?.collegeId ?? '',
      programId:
        staffRecord?.programId ?? '',
      positionId:
        staffRecord?.positionId ?? '',
      subRole:
        staffRecord?.subRole ?? '',
    });

    this.editSectionSuggestions = [];
    this.editRoleSuggestions = [];

    this.showEditSectionDropdown.set(false);
    this.showEditRoleDropdown.set(false);
    this.activeEditSectionIndex.set(-1);
    this.activeEditRoleIndex.set(-1);

    this.editSubmitting = false;
    this.editSubmitError = null;

    this.lockBodyScroll();

    if (this.viewInitialized) {
      this.focusEditRoleModal();
    }
  }

  // Edit Modal: College/Program dropdowns
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

  closeEditModal(): void {
    if (this.editSubmitting) {
      return;
    }

    this.editingMember = null;
    this.editForm.reset();

    this.showEditSectionDropdown.set(false);
    this.showEditRoleDropdown.set(false);
    this.activeEditSectionIndex.set(-1);
    this.activeEditRoleIndex.set(-1);

    this.editSubmitting = false;
    this.editSubmitError = null;

    this.unlockBodyScroll();
    this.restorePreviousFocus();
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
        next: () => {
          this.closeEditModal();
        },
                error: () => {
          this.editSubmitError = 'Failed to update staff member. Please try again.';
        },
      });
  }

  onEditSectionFocus(): void {
    const value =
      String(
        this.editForm
          .get('section')
          ?.value ?? ''
      );

    this.editSectionSuggestions =
      this.filterSections(value);

    this.activeEditSectionIndex.set(
      this.editSectionSuggestions.length > 0
        ? 0
        : -1
    );

    this.showEditSectionDropdown.set(true);
  }

  onEditSectionSearch(
    event: Event
  ): void {
    const value =
      (event.target as HTMLInputElement)
        .value;

    this.editForm
      .get('section')
      ?.setValue(value, {
        emitEvent: false,
      });

    this.editSectionSuggestions =
      this.filterSections(value);

    this.activeEditSectionIndex.set(
      this.editSectionSuggestions.length > 0
        ? 0
        : -1
    );

    this.showEditSectionDropdown.set(true);

    this.editForm
      .get('role')
      ?.reset('', {
        emitEvent: false,
      });

    this.editRoleSuggestions = [];

    this.activeEditRoleIndex.set(-1);
    this.showEditRoleDropdown.set(false);
  }

  selectEditSection(
    section: string
  ): void {
    this.editForm
      .get('section')
      ?.setValue(section);

    this.editForm
      .get('role')
      ?.reset('', {
        emitEvent: false,
      });

    this.editRoleSuggestions = [];

    this.activeEditRoleIndex.set(-1);
    this.showEditRoleDropdown.set(false);

    this.activeEditSectionIndex.set(-1);
    this.showEditSectionDropdown.set(false);
  }

  hideEditSectionDropdown(): void {
    setTimeout(() => {
      this.showEditSectionDropdown.set(false);
      this.activeEditSectionIndex.set(-1);
    }, 150);
  }

  onEditSectionKeydown(
    event: KeyboardEvent
  ): void {
    const suggestions =
      this.editSectionSuggestions;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (
          !this.showEditSectionDropdown()
        ) {
          this.showEditSectionDropdown.set(
            true
          );
        }

        if (!suggestions.length) {
          this.activeEditSectionIndex.set(
            -1
          );

          return;
        }

        const current =
          this.activeEditSectionIndex();

        this.activeEditSectionIndex.set(
          current < 0
            ? 0
            : (
                current + 1
              ) % suggestions.length
        );

        this.scrollActiveOptionIntoView(
          'edit-section-option',
          this.activeEditSectionIndex()
        );

        return;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (
          !this.showEditSectionDropdown()
        ) {
          this.showEditSectionDropdown.set(
            true
          );
        }

        if (!suggestions.length) {
          this.activeEditSectionIndex.set(
            -1
          );

          return;
        }

        const current =
          this.activeEditSectionIndex();

        this.activeEditSectionIndex.set(
          current <= 0
            ? suggestions.length - 1
            : current - 1
        );

        this.scrollActiveOptionIntoView(
          'edit-section-option',
          this.activeEditSectionIndex()
        );

        return;
      }

      case 'Enter': {
        const current =
          this.activeEditSectionIndex();

        if (
          !this.showEditSectionDropdown() ||
          current < 0 ||
          current >= suggestions.length
        ) {
          return;
        }

        event.preventDefault();

        this.selectEditSection(
          suggestions[current]
        );

        return;
      }

      case 'Escape': {
        if (
          !this.showEditSectionDropdown()
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showEditSectionDropdown.set(
          false
        );

        this.activeEditSectionIndex.set(
          -1
        );

        return;
      }

      case 'Tab': {
        this.showEditSectionDropdown.set(
          false
        );

        this.activeEditSectionIndex.set(
          -1
        );

        return;
      }

      default:
        return;
    }
  }

  onEditRoleFocus(): void {
    const value =
      String(
        this.editForm
          .get('role')
          ?.value ?? ''
      );

    this.editRoleSuggestions =
      this.filterEditRoles(value);

    this.activeEditRoleIndex.set(
      this.findNextEnabledEditRoleIndex(
        this.editRoleSuggestions,
        -1,
        1
      )
    );

    this.showEditRoleDropdown.set(true);
  }

  onEditRoleSearch(
    event: Event
  ): void {
    const value =
      (event.target as HTMLInputElement)
        .value;

    this.editForm
      .get('role')
      ?.setValue(value, {
        emitEvent: false,
      });

    this.editRoleSuggestions =
      this.filterEditRoles(value);

    this.activeEditRoleIndex.set(
      this.findNextEnabledEditRoleIndex(
        this.editRoleSuggestions,
        -1,
        1
      )
    );

    this.showEditRoleDropdown.set(true);
  }

  selectEditRole(
    role: string
  ): void {
    if (
      this.isEditRoleTakenInDropdown(
        role
      )
    ) {
      return;
    }

    this.editForm
      .get('role')
      ?.setValue(role);

    this.activeEditRoleIndex.set(-1);
    this.showEditRoleDropdown.set(false);
  }

  hideEditRoleDropdown(): void {
    setTimeout(() => {
      this.showEditRoleDropdown.set(
        false
      );

      this.activeEditRoleIndex.set(-1);
    }, 150);
  }

  onEditRoleKeydown(
    event: KeyboardEvent
  ): void {
    const roles =
      this.editRoleSuggestions;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (
          !this.showEditRoleDropdown()
        ) {
          this.showEditRoleDropdown.set(
            true
          );
        }

        this.activeEditRoleIndex.set(
          this.findNextEnabledEditRoleIndex(
            roles,
            this.activeEditRoleIndex(),
            1
          )
        );

        if (
          this.activeEditRoleIndex() >= 0
        ) {
          this.scrollActiveOptionIntoView(
            'edit-role-option',
            this.activeEditRoleIndex()
          );
        }

        return;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (
          !this.showEditRoleDropdown()
        ) {
          this.showEditRoleDropdown.set(
            true
          );
        }

        this.activeEditRoleIndex.set(
          this.findNextEnabledEditRoleIndex(
            roles,
            this.activeEditRoleIndex() < 0
              ? 0
              : this.activeEditRoleIndex(),
            -1
          )
        );

        if (
          this.activeEditRoleIndex() >= 0
        ) {
          this.scrollActiveOptionIntoView(
            'edit-role-option',
            this.activeEditRoleIndex()
          );
        }

        return;
      }

      case 'Enter': {
        const activeIndex =
          this.activeEditRoleIndex();

        if (
          !this.showEditRoleDropdown() ||
          activeIndex < 0 ||
          activeIndex >= roles.length
        ) {
          return;
        }

        const selectedRole =
          roles[activeIndex];

        if (
          this.isEditRoleTakenInDropdown(
            selectedRole
          )
        ) {
          return;
        }

        event.preventDefault();

        this.selectEditRole(
          selectedRole
        );

        return;
      }

      case 'Escape': {
        if (
          !this.showEditRoleDropdown()
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showEditRoleDropdown.set(
          false
        );

        this.activeEditRoleIndex.set(-1);

        return;
      }

      case 'Tab': {
        this.showEditRoleDropdown.set(
          false
        );

        this.activeEditRoleIndex.set(-1);

        return;
      }

      default:
        return;
    }
  }

  private filterEditRoles(query: string): string[] {
    const roles = this.editAvailableRoles;
    const q = query.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(r => r.toLowerCase().includes(q));
  }

  private findNextEnabledEditRoleIndex(
    roles: string[],
    startIndex: number,
    direction: 1 | -1
  ): number {
    if (!roles.length) {
      return -1;
    }

    let index = startIndex;

    for (
      let attempts = 0;
      attempts < roles.length;
      attempts += 1
    ) {
      index =
        (
          index +
          direction +
          roles.length
        ) % roles.length;

      if (
        !this.isEditRoleTakenInDropdown(
          roles[index]
        )
      ) {
        return index;
      }
    }

    return -1;
  }

  // Edit Role Conflict
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


  // Assign Unassigned Staff to Board

  readonly assignStaffSubmitting =
    signal(false);

  readonly assignStaffSubmitError =
    signal<string | null>(null);

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

  openAssignStaffModal(
    staff: StaffMember
  ): void {
    this.previouslyFocusedElement =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.assigningStaff = staff;

    const current =
      this.getCurrentBoardAssignments(
        staff.id,
        staff.fullName
      );

    this.assignStaffForm.reset({
      section:
        current.length === 0
          ? staff.assignedSection ?? ''
          : '',
      role:
        current.length === 0
          ? staff.assignedRole ?? ''
          : '',
    });

    this.assignStaffSectionSuggestions = [];
    this.assignStaffRoleSuggestions = [];

    this.showAssignStaffSectionDropdown = false;
    this.showAssignStaffRoleDropdown = false;
    this.activeAssignStaffSectionIndex = -1;
    this.activeAssignStaffRoleIndex = -1;
    this.assignStaffSubmitting.set(false);
    this.assignStaffSubmitError.set(null);

    this.lockBodyScroll();

    if (this.viewInitialized) {
      this.focusAssignStaffModal();
    }
  }

  closeAssignStaffModal(): void {
    if (this.assignStaffSubmitting()) {
      return;
    }

    this.assigningStaff = null;
    this.assignStaffForm.reset();

    this.showAssignStaffSectionDropdown = false;
    this.showAssignStaffRoleDropdown = false;
    this.activeAssignStaffSectionIndex = -1;
    this.activeAssignStaffRoleIndex = -1;
    this.assignStaffSubmitError.set(null);

    this.unlockBodyScroll();
    this.restorePreviousFocus();
  }

  onAssignStaffSectionFocus(): void {
    const value =
      String(
        this.assignStaffForm
          .get('section')
          ?.value ?? ''
      );

    this.assignStaffSectionSuggestions =
      this.filterAssignSections(value);

    this.activeAssignStaffSectionIndex =
      this.assignStaffSectionSuggestions.length > 0
        ? 0
        : -1;

    this.showAssignStaffSectionDropdown = true;
  }

  onAssignStaffSectionSearch(
    event: Event
  ): void {
    const value =
      (event.target as HTMLInputElement)
        .value;

    this.assignStaffForm
      .get('section')
      ?.setValue(
        value,
        {
          emitEvent: false,
        }
      );

    this.assignStaffSectionSuggestions =
      this.filterAssignSections(value);

    this.activeAssignStaffSectionIndex =
      this.assignStaffSectionSuggestions.length > 0
        ? 0
        : -1;

    this.showAssignStaffSectionDropdown = true;

    this.assignStaffForm
      .get('role')
      ?.reset();

    this.assignStaffRoleSuggestions = [];
    this.activeAssignStaffRoleIndex = -1;
    this.showAssignStaffRoleDropdown = false;
  }

  selectAssignStaffSection(
    section: string
  ): void {
    this.assignStaffForm
      .get('section')
      ?.setValue(section);

    this.assignStaffForm
      .get('role')
      ?.reset();

    this.assignStaffRoleSuggestions = [];
    this.activeAssignStaffRoleIndex = -1;
    this.showAssignStaffRoleDropdown = false;

    this.activeAssignStaffSectionIndex = -1;
    this.showAssignStaffSectionDropdown = false;
  }

  hideAssignStaffSectionDropdown(): void {
    setTimeout(() => {
      this.showAssignStaffSectionDropdown =
        false;

      this.activeAssignStaffSectionIndex =
        -1;
    }, 150);
  }

  onAssignStaffSectionKeydown(
    event: KeyboardEvent
  ): void {
    const suggestions =
      this.assignStaffSectionSuggestions;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (
          !this.showAssignStaffSectionDropdown
        ) {
          this.showAssignStaffSectionDropdown =
            true;
        }

        if (!suggestions.length) {
          this.activeAssignStaffSectionIndex =
            -1;

          return;
        }

        this.activeAssignStaffSectionIndex =
          this.activeAssignStaffSectionIndex < 0
            ? 0
            : (
                this.activeAssignStaffSectionIndex +
                1
              ) % suggestions.length;

        this.scrollActiveOptionIntoView(
          'assign-staff-section-option',
          this.activeAssignStaffSectionIndex
        );

        return;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (
          !this.showAssignStaffSectionDropdown
        ) {
          this.showAssignStaffSectionDropdown =
            true;
        }

        if (!suggestions.length) {
          this.activeAssignStaffSectionIndex =
            -1;

          return;
        }

        this.activeAssignStaffSectionIndex =
          this.activeAssignStaffSectionIndex <= 0
            ? suggestions.length - 1
            : this.activeAssignStaffSectionIndex -
              1;

        this.scrollActiveOptionIntoView(
          'assign-staff-section-option',
          this.activeAssignStaffSectionIndex
        );

        return;
      }

      case 'Enter': {
        if (
          !this.showAssignStaffSectionDropdown ||
          this.activeAssignStaffSectionIndex <
            0 ||
          this.activeAssignStaffSectionIndex >=
            suggestions.length
        ) {
          return;
        }

        event.preventDefault();

        this.selectAssignStaffSection(
          suggestions[
            this.activeAssignStaffSectionIndex
          ]
        );

        return;
      }

      case 'Escape': {
        if (
          !this.showAssignStaffSectionDropdown
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showAssignStaffSectionDropdown =
          false;

        this.activeAssignStaffSectionIndex =
          -1;

        return;
      }

      case 'Tab': {
        this.showAssignStaffSectionDropdown =
          false;

        this.activeAssignStaffSectionIndex =
          -1;

        return;
      }

      default:
        return;
    }
  }

  onAssignStaffRoleFocus(): void {
    const value =
      String(
        this.assignStaffForm
          .get('role')
          ?.value ?? ''
      );

    this.assignStaffRoleSuggestions =
      this.filterAssignStaffRoles(value);

    this.activeAssignStaffRoleIndex =
      this.findNextEnabledAssignStaffRoleIndex(
        this.assignStaffRoleSuggestions,
        -1,
        1
      );

    this.showAssignStaffRoleDropdown = true;
  }

  onAssignStaffRoleSearch(
    event: Event
  ): void {
    const value =
      (event.target as HTMLInputElement)
        .value;

    this.assignStaffForm
      .get('role')
      ?.setValue(value, {
        emitEvent: false,
      });

    this.assignStaffRoleSuggestions =
      this.filterAssignStaffRoles(value);

    this.activeAssignStaffRoleIndex =
      this.findNextEnabledAssignStaffRoleIndex(
        this.assignStaffRoleSuggestions,
        -1,
        1
      );

    this.showAssignStaffRoleDropdown = true;
  }

  selectAssignStaffRole(
    role: string
  ): void {
    if (
      this.isAssignStaffRoleTakenInDropdown(
        role
      )
    ) {
      return;
    }

    this.assignStaffForm
      .get('role')
      ?.setValue(role);

    this.activeAssignStaffRoleIndex = -1;
    this.showAssignStaffRoleDropdown = false;
  }

  hideAssignStaffRoleDropdown(): void {
    setTimeout(() => {
      this.showAssignStaffRoleDropdown =
        false;

      this.activeAssignStaffRoleIndex =
        -1;
    }, 150);
  }

  onAssignStaffRoleKeydown(
    event: KeyboardEvent
  ): void {
    const roles =
      this.assignStaffRoleSuggestions;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (
          !this.showAssignStaffRoleDropdown
        ) {
          this.showAssignStaffRoleDropdown =
            true;
        }

        this.activeAssignStaffRoleIndex =
          this.findNextEnabledAssignStaffRoleIndex(
            roles,
            this.activeAssignStaffRoleIndex,
            1
          );

        if (
          this.activeAssignStaffRoleIndex >= 0
        ) {
          this.scrollActiveOptionIntoView(
            'assign-staff-role-option',
            this.activeAssignStaffRoleIndex
          );
        }

        return;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (
          !this.showAssignStaffRoleDropdown
        ) {
          this.showAssignStaffRoleDropdown =
            true;
        }

        this.activeAssignStaffRoleIndex =
          this.findNextEnabledAssignStaffRoleIndex(
            roles,
            this.activeAssignStaffRoleIndex < 0
              ? 0
              : this.activeAssignStaffRoleIndex,
            -1
          );

        if (
          this.activeAssignStaffRoleIndex >= 0
        ) {
          this.scrollActiveOptionIntoView(
            'assign-staff-role-option',
            this.activeAssignStaffRoleIndex
          );
        }

        return;
      }

      case 'Enter': {
        if (
          !this.showAssignStaffRoleDropdown ||
          this.activeAssignStaffRoleIndex < 0 ||
          this.activeAssignStaffRoleIndex >=
            roles.length
        ) {
          return;
        }

        const selectedRole =
          roles[
            this.activeAssignStaffRoleIndex
          ];

        if (
          this.isAssignStaffRoleTakenInDropdown(
            selectedRole
          )
        ) {
          return;
        }

        event.preventDefault();

        this.selectAssignStaffRole(
          selectedRole
        );

        return;
      }

      case 'Escape': {
        if (
          !this.showAssignStaffRoleDropdown
        ) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showAssignStaffRoleDropdown =
          false;

        this.activeAssignStaffRoleIndex =
          -1;

        return;
      }

      case 'Tab': {
        this.showAssignStaffRoleDropdown =
          false;

        this.activeAssignStaffRoleIndex =
          -1;

        return;
      }

      default:
        return;
    }
  }

  private filterAssignStaffRoles(query: string): string[] {
    const roles = this.assignStaffAvailableRoles;
    const q = query.toLowerCase().trim();
    if (!q) return roles;
    return roles.filter(r => r.toLowerCase().includes(q));
  }

  private findNextEnabledAssignStaffRoleIndex(
    roles: string[],
    startIndex: number,
    direction: 1 | -1
  ): number {
    if (!roles.length) {
      return -1;
    }

    let index = startIndex;

    for (
      let attempts = 0;
      attempts < roles.length;
      attempts += 1
    ) {
      index =
        (
          index +
          direction +
          roles.length
        ) % roles.length;

      if (
        !this.isAssignStaffRoleTakenInDropdown(
          roles[index]
        )
      ) {
        return index;
      }
    }

    return -1;
  }

  submitAssignStaff(): void {
    const staff =
      this.assigningStaff;

    if (
      !staff ||
      this.assignStaffForm.invalid ||
      this.assignStaffRoleConflict ||
      this.assignStaffSectionConflict ||
      this.assignStaffSubmitting()
    ) {
      this.assignStaffForm.markAllAsTouched();
      return;
    }

    const {
      section,
      role,
    } = this.assignStaffForm.value as {
      section: string;
      role: string;
    };

    const trimmedSection =
      section.trim();

    const trimmedRole =
      role.trim();

    this.assignStaffSubmitting.set(true);
    this.assignStaffSubmitError.set(null);

    this.editorialBoardService
      .addMemberToBoard(
        staff.id,
        trimmedSection,
        trimmedRole
      )
      .pipe(
        finalize(() => {
          this.assignStaffSubmitting.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.closeAssignStaffModal();
        },

        error: error => {
          console.error(
            'Failed to add staff member to board:',
            error
          );

          this.assignStaffSubmitError.set(
            error?.error?.error ??
            'Unable to add this staff member to the board. Please try again.'
          );
        },
      });
  }

  onAssignDialogKeydown(
    event: KeyboardEvent
  ): void {
    this.trapFocus(
      event,
      this.assignDialog?.nativeElement
    );
  }

  onAssignStaffDialogKeydown(
    event: KeyboardEvent
  ): void {
    this.trapFocus(
      event,
      this.assignStaffDialog
        ?.nativeElement
    );
  }

  onNewBoardDialogKeydown(
    event: KeyboardEvent
  ): void {
    this.trapFocus(
      event,
      this.newBoardDialog?.nativeElement
    );
  }

  onEditRoleDialogKeydown(
    event: KeyboardEvent
  ): void {
    this.trapFocus(
      event,
      this.editRoleDialog?.nativeElement
    );
  }

  onRevokeAcceptanceDialogKeydown(
    event: KeyboardEvent
  ): void {
    this.trapFocus(
      event,
      this.revokeAcceptanceDialog
        ?.nativeElement
    );
  }

  // Revoke Acceptance
  revokingApp: Application | null = null;

  openRevokeModal(
    app: Application
  ): void {
    this.previouslyFocusedElement =
      typeof document !== 'undefined' &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    this.revokingApp = app;
    this.revokeAcceptanceError.set(null);

    this.lockBodyScroll();

    if (this.viewInitialized) {
      this.focusRevokeAcceptanceModal();
    }
  }

  closeRevokeModal(): void {
    if (this.revokeAcceptanceSubmitting()) {
      return;
    }

    this.revokingApp = null;
    this.revokeAcceptanceError.set(null);

    this.unlockBodyScroll();
    this.restorePreviousFocus();
  }

  confirmRevoke(): void {
    const application = this.revokingApp;

    if (
      !application?.id ||
      this.revokeAcceptanceSubmitting()
    ) {
      return;
    }

    this.revokeAcceptanceSubmitting.set(true);
    this.revokeAcceptanceError.set(null);

    this.applicationService
      .revokeAcceptance(application.id)
      .pipe(
        finalize(() => {
          this.revokeAcceptanceSubmitting.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.closeRevokeModal();
        },

        error: error => {
          this.revokeAcceptanceError.set(
            error?.error?.error ??
            'Unable to revoke this application’s acceptance. Please try again.'
          );
        },
      });
  }

  // Exec Role Validation
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


  // Remove Member
  revokingMember: {
    member: BoardMember;
    sectionTitle: string;
  } | null = null;

  revokeError: string | null = null;
  revokeSubmitting = signal(false);

  openRevokeMemberModal(
    member: BoardMember,
    sectionTitle: string
  ): void {
    this.revokingMember = {
      member,
      sectionTitle,
    };

    this.revokeError = null;
  }

  closeRevokeMemberModal(): void {
    if (this.revokeSubmitting()) return;

    this.revokingMember = null;
    this.revokeError = null;
  }

confirmRevokeMember(): void {
  if (
    !this.revokingMember ||
    this.revokeSubmitting()
  ) {
    return;
  }

  const { member } = this.revokingMember;

  const boardId =
    this.editorialBoardService.activeBoardId;

  const boardMemberId =
    member.boardMemberId;

  if (!boardId || !boardMemberId) {
    this.revokeError =
      'This staff member is missing a board assignment record. Refresh the page and try again.';
    return;
  }

  this.revokeSubmitting.set(true);
  this.revokeError = null;

  this.editorialBoardService
    .revokeMember(
      boardId,
      boardMemberId
    )
    .pipe(
      finalize(() => {
        this.revokeSubmitting.set(false);
      })
    )
    .subscribe({
      next: () => {
        if (
          this.editorialBoardService
            .isBoardSatisfied
        ) {
          this.editorialBoardService
            .satisfyBoard(false)
            .subscribe({
              error: error => {
                console.error(
                  'Failed to clear board satisfaction:',
                  error
                );
              },
            });
        }

        this.revokingMember = null;
        this.revokeError = null;
      },

      error: err => {
        console.error(
          'Failed to revoke board member:',
          err
        );

        this.revokeError =
          err?.error?.error ??
          'Failed to revoke this board assignment. Please try again.';
      },
    });
}

  // Submit
  submitAssign(): void {
    const application =
      this.pendingApp;

    if (
      !application?.id ||
      this.assignForm.invalid ||
      this.assignRoleConflict ||
      this.assignSubmitting()
    ) {
      this.assignForm.markAllAsTouched();
      return;
    }

    const boardId =
      this.editorialBoardService.activeBoardId;

    if (!boardId) {
      this.assignSubmitError.set(
        'No active editorial board was found.'
      );
      return;
    }

    const {
      section,
      role,
    } = this.assignForm.value as {
      section: string;
      role: string;
    };

    const trimmedSection =
      section.trim();

    const trimmedRole =
      role.trim();

    this.assignSubmitting.set(true);
    this.assignSubmitError.set(null);

    this.editorialBoardService
      .assignApplicationToBoard(
        boardId,
        application.id,
        trimmedSection,
        trimmedRole
      )
      .pipe(
        finalize(() => {
          this.assignSubmitting.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.closeAssignModal();
        },

        error: error => {
          console.error(
            'Failed to assign applicant:',
            error
          );

          this.assignSubmitError.set(
            error?.error?.error ??
            'Unable to complete the board assignment. Please try again.'
          );
        },
      });
  }


  // Helper
  generateInitials(name: string): string {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  private focusAssignModal(): void {
    queueMicrotask(() => {
      const closeButton =
        this.assignCloseButton?.nativeElement;

      const dialog =
        this.assignDialog?.nativeElement;

      if (closeButton) {
        closeButton.focus();
        return;
      }

      dialog?.focus();
    });
  }

  private focusAssignStaffModal(): void {
    queueMicrotask(() => {
      const closeButton =
        this.assignStaffCloseButton
          ?.nativeElement;

      const dialog =
        this.assignStaffDialog
          ?.nativeElement;

      if (closeButton) {
        closeButton.focus();
        return;
      }

      dialog?.focus();
    });
  }

  private focusNewBoardModal(): void {
    queueMicrotask(() => {
      const closeButton =
        this.newBoardCloseButton?.nativeElement;

      const dialog =
        this.newBoardDialog?.nativeElement;

      if (closeButton) {
        closeButton.focus();
        return;
      }

      dialog?.focus();
    });
  }

  private focusEditRoleModal(): void {
    queueMicrotask(() => {
      const closeButton =
        this.editRoleCloseButton
          ?.nativeElement;

      const dialog =
        this.editRoleDialog
          ?.nativeElement;

      if (closeButton) {
        closeButton.focus();
        return;
      }

      dialog?.focus();
    });
  }

  private focusRevokeAcceptanceModal(): void {
    queueMicrotask(() => {
      const closeButton =
        this.revokeAcceptanceCloseButton
          ?.nativeElement;

      const dialog =
        this.revokeAcceptanceDialog
          ?.nativeElement;

      if (closeButton) {
        closeButton.focus();
        return;
      }

      dialog?.focus();
    });
  }

  private lockBodyScroll(): void {
    if (
      this.isBodyScrollLocked ||
      typeof document === 'undefined'
    ) {
      return;
    }

    this.previousBodyOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';
    this.isBodyScrollLocked = true;
  }

  private unlockBodyScroll(): void {
    if (
      !this.isBodyScrollLocked ||
      typeof document === 'undefined'
    ) {
      return;
    }

    document.body.style.overflow =
      this.previousBodyOverflow;

    this.previousBodyOverflow = '';
    this.isBodyScrollLocked = false;
  }

  private restorePreviousFocus(): void {
    const target =
      this.previouslyFocusedElement;

    this.previouslyFocusedElement = null;

    if (
      !target ||
      typeof document === 'undefined' ||
      !document.contains(target)
    ) {
      return;
    }

    queueMicrotask(() => {
      target.focus({
        preventScroll: true
      });
    });
  }

  private trapFocus(
    event: KeyboardEvent,
    dialog?: HTMLElement
  ): void {
    if (
      event.key !== 'Tab' ||
      !dialog
    ) {
      return;
    }

    const focusableElements = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        [
          'button:not([disabled])',
          'input:not([disabled])',
          'select:not([disabled])',
          'textarea:not([disabled])',
          'a[href]',
          '[tabindex]:not([tabindex="-1"])',
        ].join(',')
      )
    ).filter(element =>
      element.offsetParent !== null &&
      element.getAttribute(
        'aria-hidden'
      ) !== 'true'
    );

    if (!focusableElements.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first =
      focusableElements[0];

    const last =
      focusableElements[
        focusableElements.length - 1
      ];

    const active =
      document.activeElement;

    if (
      event.shiftKey &&
      (
        active === first ||
        active === dialog
      )
    ) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (
      !event.shiftKey &&
      active === last
    ) {
      event.preventDefault();
      first.focus();
    }
  }


  //Touch State
  onSectionTouchStart(event: TouchEvent): void {
    this.sectionTouchStartX =
      event.changedTouches[0]?.clientX ?? null;
  }

  onSectionTouchEnd(
    event: TouchEvent,
    total: number
  ): void {
    if (
      this.sectionTouchStartX === null ||
      total <= 1
    ) {
      return;
    }

    const endX =
      event.changedTouches[0]?.clientX;

    if (endX === undefined) {
      this.sectionTouchStartX = null;
      return;
    }

    const distance =
      endX - this.sectionTouchStartX;

    this.sectionTouchStartX = null;

    if (
      Math.abs(distance) <
      this.sectionSwipeThreshold
    ) {
      return;
    }

    if (distance > 0) {
      this.prevSection(total);
      return;
    }

    this.nextSection(total);
  }

  onAssignSectionKeydown(
    event: KeyboardEvent
  ): void {
    const suggestions =
      this.sectionSuggestions;

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();

        if (!this.showSectionDropdown) {
          this.showSectionDropdown = true;
        }

        if (!suggestions.length) {
          this.activeSectionIndex = -1;
          return;
        }

        this.activeSectionIndex =
          this.activeSectionIndex < 0
            ? 0
            : (
                this.activeSectionIndex + 1
              ) % suggestions.length;

        this.scrollActiveOptionIntoView(
          'assign-section-option',
          this.activeSectionIndex
        );

        return;
      }

      case 'ArrowUp': {
        event.preventDefault();

        if (!this.showSectionDropdown) {
          this.showSectionDropdown = true;
        }

        if (!suggestions.length) {
          this.activeSectionIndex = -1;
          return;
        }

        this.activeSectionIndex =
          this.activeSectionIndex <= 0
            ? suggestions.length - 1
            : this.activeSectionIndex - 1;

        this.scrollActiveOptionIntoView(
          'assign-section-option',
          this.activeSectionIndex
        );

        return;
      }

      case 'Enter': {
        if (
          !this.showSectionDropdown ||
          this.activeSectionIndex < 0 ||
          this.activeSectionIndex >=
            suggestions.length
        ) {
          return;
        }

        event.preventDefault();

        this.selectSection(
          suggestions[
            this.activeSectionIndex
          ]
        );

        return;
      }

      case 'Escape': {
        if (!this.showSectionDropdown) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.showSectionDropdown = false;
        this.activeSectionIndex = -1;

        return;
      }

      case 'Tab': {
        this.showSectionDropdown = false;
        this.activeSectionIndex = -1;
        return;
      }

      default:
        return;
    }
  }

  private scrollActiveOptionIntoView(
    optionIdPrefix: string,
    index: number
  ): void {
    queueMicrotask(() => {
      const option =
        document.getElementById(
          `${optionIdPrefix}-${index}`
        );

      option?.scrollIntoView({
        block: 'nearest',
      });
    });
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
      if (this.revokingApp) {
        if (this.revokeAcceptanceSubmitting()) {
          return;
        }

        this.closeRevokeModal();
        return;
      }

    if (this.editingMember) {
      if (this.editSubmitting) {
        return;
      }

      this.closeEditModal();
      return;
    }

    if (this.showNewBoardModal()) {
      if (this.newBoardSubmitting()) {
        return;
      }

      this.closeNewBoardModal();
      return;
    }

    if (this.assigningStaff) {
      if (this.assignStaffSubmitting()) {
        return;
      }

      this.closeAssignStaffModal();
      return;
    }

    if (this.pendingApp) {
      if (this.assignSubmitting()) {
        return;
      }

      this.closeAssignModal();
    }
  }
}
