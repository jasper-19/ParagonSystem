/*
  EditorialBoardService
  - Purpose: manage the in-memory editorial board state and provide API
    operations for fetching and mutating editorial boards and their members.
  - Changes: only formatting, grouping, and explanatory comments added.
*/

export type AssignApplicationToBoardResponse = {
  board: {
    id: string;
    academicYear: string;
    adviserName: string;
    isActive: boolean;
    isSatisfied: boolean;
    createdAt?: string;
  };

  application: Application;

  staff: StaffMember;

  boardMember: {
    id: string;
    boardId: string;
    staffId: string;
    section: string;
    role: string;
    createdAt?: string;
  };
};

import {
  BehaviorSubject,
  Observable,
  EMPTY,
  catchError,
  map,
  tap,
  distinctUntilChanged,
  finalize,
  throwError,
  forkJoin,
  defaultIfEmpty,
} from 'rxjs';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  EditorialBoardData,
  BoardMember,
  BoardSection,
  ApiActiveBoard,
  ApiBoardMember,
  ApiBoard,
} from '../../models/editorial-board.model';
import { Application } from '../../models/application.model';
import { StaffMember } from '../../models/staff-member.model';
import { SocketService } from './socket.service';

import { API_ENDPOINTS } from '../config/api.config';

@Injectable({ providedIn: 'root' })
export class EditorialBoardService {

  // API endpoint constants for editorial board operations
  private readonly apiUrl = API_ENDPOINTS.editorialBoard;

  // BehaviorSubjects for in-memory state management
  private readonly allBoardsSubject =
    new BehaviorSubject<ApiBoard[]>([]);

  readonly allBoards$ =
    this.allBoardsSubject.asObservable();

  // Use constructor-less injection for compact service instantiation
  private http = inject(HttpClient);
  private socketService = inject(SocketService);

  // ===== Canonical ordering for roles within a section =====
  /** Canonical role order used for sorting members within each section. */
  private readonly ROLE_ORDER: Record<string, string[]> = {
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
    'Broadcasters': ['Senior Broadcaster', 'Junior Broadcaster'],
  };

  private realtimeRefreshInProgress =
    false;

  private realtimeRefreshPending =
    false;

  constructor() {
    this.initializeRealtime();
  }

  private initializeRealtime(): void {
    this.socketService
      .onEditorialBoardUpdated(() => {
        console.log(
          '📡 Editorial board updated'
        );

        this.refreshFromRealtime();
      });
  }

  private refreshFromRealtime(): void {
    if (
      this.realtimeRefreshInProgress
    ) {
      this.realtimeRefreshPending = true;
      return;
    }

    this.realtimeRefreshInProgress = true;

    forkJoin({
      activeBoard:
        this.loadAdminActiveBoard()
          .pipe(
            defaultIfEmpty(undefined)
          ),

      boards:
        this.getAllBoards(),
    })
      .pipe(
        finalize(() => {
          this.realtimeRefreshInProgress =
            false;

          if (
            this.realtimeRefreshPending
          ) {
            this.realtimeRefreshPending =
              false;

            this.refreshFromRealtime();
          }
        })
      )
      .subscribe({
        error: error => {
          console.error(
            'Failed to synchronize editorial-board state:',
            error
          );
        },
      });
  }

  // ===== Active board tracking =====
  /** ID of the board currently loaded from the API */
  private _activeBoardId = new BehaviorSubject<string | null>(null);
  get activeBoardId() {
    return this._activeBoardId.value;
  }

  readonly hasActiveBoard$ = this._activeBoardId.pipe(
    map((id) => id !== null),
    distinctUntilChanged()
  );

  /** Emits true once loadActiveBoard() has resolved (whether a board exists or not) */
  private _boardLoaded = new BehaviorSubject<boolean>(false);
  readonly boardLoaded$ = this._boardLoaded.asObservable();

  /**
   * Persisted "board satisfied" flag — when true, staff with only 1 board
   * assignment are hidden from the Available for Board Assignment panel.
   * Initialized from the DB when the active board loads.
   */
  private _boardSatisfied = new BehaviorSubject<boolean>(false);
  readonly boardSatisfied$ = this._boardSatisfied.asObservable();
  get isBoardSatisfied() {
    return this._boardSatisfied.value;
  }

  // ====================================
  // Internal Board Store
  // ====================================

  private boardSubject = new BehaviorSubject<EditorialBoardData>({
    academicYear: '',
    sections: [],
    adviser: { name: '', position: 'Publication Adviser', initials: '' },
  });

  readonly board$ = this.boardSubject.asObservable();

  getCurrentBoard(): EditorialBoardData {
    return this.boardSubject.value;
  }

  // Canonical section ordering used when creating new sections
  private readonly SECTION_ORDER = [
    'Executive Editors',
    'Section Editors',
    'Staff Writers',
    'Senior Creative Producers',
    'Junior Creative Producers',
    'Broadcasters',
  ];

  // ----- Mutators for in-memory board -----
  addMember(sectionTitle: string, member: BoardMember): void {
    const board = this.boardSubject.value;

    const sectionExists = board.sections.some((s) => s.title === sectionTitle);

    let updatedSections: BoardSection[];

    if (sectionExists) {
      updatedSections = board.sections.map((section) => {
        if (section.title !== sectionTitle) return section;
        const members = [...section.members, member];
        // Keep members in canonical role order for known sections
        const order = this.ROLE_ORDER[sectionTitle];
        if (order) {
          members.sort((a, b) => {
            const ai = order.indexOf(a.position);
            const bi = order.indexOf(b.position);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
        }
        return { ...section, members };
      });
    } else {
      // Section doesn't exist yet (e.g. first member on a new board) — create it
      const newSection: BoardSection = { title: sectionTitle, members: [member] };
      updatedSections = [...board.sections, newSection].sort((a, b) => {
        const ai = this.SECTION_ORDER.indexOf(a.title);
        const bi = this.SECTION_ORDER.indexOf(b.title);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    }

    this.boardSubject.next({ ...board, sections: updatedSections });
  }

  updateMemberRole(sectionTitle: string, memberName: string, newRole: string): void {
    const board = this.boardSubject.value;
    const updatedSections = board.sections.map((section) => {
      if (section.title !== sectionTitle) return section;
      return {
        ...section,
        members: section.members.map((m) =>
          m.name === memberName ? { ...m, position: newRole } : m
        ),
      };
    });
    this.boardSubject.next({ ...board, sections: updatedSections });
  }

  updateMember(
    fromSection: string,
    memberName: string,
    toSection: string,
    newRole: string
  ): void {
    const board = this.boardSubject.value;

    if (fromSection === toSection) {
      const sections = board.sections.map((section) => {
        if (section.title !== fromSection) return section;
        return {
          ...section,
          members: section.members.map((m) =>
            m.name === memberName ? { ...m, position: newRole } : m
          ),
        };
      });
      this.boardSubject.next({ ...board, sections });
      return;
    }

    let memberToMove: BoardMember | undefined;
    const afterRemove = board.sections.map((section) => {
      if (section.title !== fromSection) return section;
      const member = section.members.find((m) => m.name === memberName);
      if (member) memberToMove = { ...member, position: newRole };
      return { ...section, members: section.members.filter((m) => m.name !== memberName) };
    });
    const afterAdd = afterRemove.map((section) => {
      if (section.title === toSection && memberToMove) {
        return { ...section, members: [...section.members, memberToMove] };
      }
      return section;
    });
    this.boardSubject.next({ ...board, sections: afterAdd });
  }

  patchMembersByStaffId(staffId: string, patch: Partial<BoardMember>): void {
    const board = this.boardSubject.value;
    const updatedSections = board.sections.map((section) => ({
      ...section,
      members: section.members.map((m) => (m.staffId === staffId ? { ...m, ...patch } : m)),
    }));
    this.boardSubject.next({ ...board, sections: updatedSections });
  }

  removeMember(sectionTitle: string, memberName: string): void {
    const board = this.boardSubject.value;
    const updatedSections = board.sections.map((section) => {
      if (section.title !== sectionTitle) return section;
      return {
        ...section,
        members: section.members.filter((m) => m.name !== memberName),
      };
    });
    this.boardSubject.next({ ...board, sections: updatedSections });
  }

  // ====================================
  // API Methods
  // ====================================

  /**
   * Fetches the latest editorial board + members from the API and replaces
   * the in-memory BehaviorSubject. Falls back silently on 404 (no board yet).
   */
loadActiveBoard(): Observable<void> {

  return this.loadBoard(
    `${this.apiUrl}/active`
  );

}

  private applyActiveBoard(
    apiBoard: ApiActiveBoard
  ): void {

    this._activeBoardId.next(apiBoard.id);
    this._boardLoaded.next(true);
    this._boardSatisfied.next(
      apiBoard.isSatisfied ?? false
    );

    const sectionMap = new Map<
      string,
      BoardMember[]
    >();

    for (const m of apiBoard.members) {

      if (!sectionMap.has(m.section)) {
        sectionMap.set(m.section, []);
      }

      sectionMap.get(m.section)!.push({
        name: m.fullName ?? '',
        position: m.role,
        initials: this.toInitials(
          m.fullName ?? ''
        ),
        boardMemberId: m.id,
        staffId: m.staffId,
        yearLevel: m.yearLevel,
      });

    }

    const sections: BoardSection[] = [];

    sectionMap.forEach((members, title) => {

      const order = this.ROLE_ORDER[title];

      if (order) {
        members.sort((a, b) => {
          const ai = order.indexOf(a.position);
          const bi = order.indexOf(b.position);

          return (ai === -1 ? 999 : ai) -
                (bi === -1 ? 999 : bi);
        });
      }

      sections.push({
        title,
        members,
      });

    });

    sections.sort((a, b) => {

      const ai =
        this.SECTION_ORDER.indexOf(a.title);

      const bi =
        this.SECTION_ORDER.indexOf(b.title);

      return (ai === -1 ? 999 : ai) -
            (bi === -1 ? 999 : bi);

    });

    this.boardSubject.next({

      academicYear: apiBoard.academicYear,

      sections,

      adviser: {
        name: apiBoard.adviserName,
        position: 'Publication Adviser',
        initials: this.toInitials(
          apiBoard.adviserName
        ),
      },

    });

  }

  private loadBoard(
    endpoint: string
  ): Observable<void> {
    return this.http
      .get<ApiActiveBoard>(endpoint)
      .pipe(
        map(board => {
          this.applyActiveBoard(
            board
          );
        }),

        catchError(error => {
          if (error.status === 404) {
            this.clearActiveBoard();
            return EMPTY;
          }

          this._boardLoaded.next(true);

          console.error(
            'Failed to load board:',
            error
          );

          return throwError(() => error);
        })
      );
  }

  loadAdminActiveBoard(): Observable<void> {

    return this.loadBoard(
      `${this.apiUrl}/active/admin`
    );

  }

  /** Fetches all boards (for the board-selector dropdown). */
  getAllBoards(): Observable<ApiBoard[]> {
    return this.http
      .get<ApiBoard[]>(
        this.apiUrl
      )
      .pipe(
        tap(boards => {
          this.allBoardsSubject.next(
            boards
          );
        })
      );
  }

  /**
   * Activates a board by ID (sets is_active = true, all others false)
   * then reloads it as the current active board.
   */
  activateBoard(boardId: string): Observable<void> {
    return this.http
      .put<ApiActiveBoard>(
        `${this.apiUrl}/${boardId}/activate`,
        {}
      )
      .pipe(
        map(board => {
          this._activeBoardId.next(board.id);
          this._boardLoaded.next(true);
        })
      );
  }

  /**
   * Creates a new editorial board in the DB (inactive by default).
   * Does NOT affect the currently displayed active board.
   * Returns the newly created ApiBoard so callers can update their local lists
   * without an extra round-trip.
   */
  createBoard(academicYear: string, adviserName: string): Observable<ApiBoard> {
    return this.http.post<ApiActiveBoard>(this.apiUrl, { academicYear, adviserName }).pipe(
      map((board) => ({
        id: board.id,
        academicYear: board.academicYear,
        adviserName: board.adviserName,
        isActive: board.isActive,
        isSatisfied: board.isSatisfied ?? false,
        createdAt: board.createdAt,
      } satisfies ApiBoard))
    );
  }

  deleteBoard(boardId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${boardId}`);
  }

  /**
   * Persists the "board satisfied" flag to the DB and updates the local state.
   * When satisfied=true, staff with only 1 board assignment are hidden from
   * the available panel.
   */
  satisfyBoard(satisfied: boolean): Observable<void> {
    const boardId = this._activeBoardId.value;
    if (!boardId) return EMPTY;
    return this.http.put<ApiBoard>(`${this.apiUrl}/${boardId}/satisfy`, { satisfied }).pipe(
      map((board) => {
        this._boardSatisfied.next(board.isSatisfied ?? satisfied);
      })
    );
  }

  // API call to assign an application to a board, creating a new board member in the process.
  assignApplicationToBoard(
    boardId: string,
    applicationId: string,
    section: string,
    role: string
  ): Observable<AssignApplicationToBoardResponse> {
    return this.http.post<AssignApplicationToBoardResponse>(
      `${this.apiUrl}/${boardId}/assign-application`,
      {
        applicationId,
        section,
        role,
      }
    );
  }

  /**
   * Persists a staff member as a board member in the DB.
   * No-op if no active board is loaded yet.
   */
  addMemberToBoard(staffId: string, section: string, role: string): Observable<ApiBoardMember> {
    if (!this._activeBoardId.value) return EMPTY as Observable<ApiBoardMember>;
    return this.http.post<ApiBoardMember>(
      `${this.apiUrl}/${this._activeBoardId.value}/members`,
      { staffId, section, role }
    );
  }

  updateMemberOnBoard(boardId: string, memberId: string, section: string, role: string): Observable<ApiBoardMember> {
    return this.http.patch<ApiBoardMember>(
      `${this.apiUrl}/${boardId}/members/${memberId}`,
      { section, role }
    );
  }

  revokeMember(boardId: string, boardMemberId: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/${boardId}/members/${boardMemberId}/revoke`, {});
  }

  /** Removes a member from the board only — does NOT delete the staff_member record. */
  removeMemberFromBoard(boardId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${boardId}/members/${memberId}`);
  }

  /** Sets boardMemberId (and optionally staffId) on an already-added in-memory member. */
  patchMemberBoardId(sectionTitle: string, memberName: string, boardMemberId: string, staffId?: string): void {
    const board = this.boardSubject.value;
    const updatedSections = board.sections.map((section) => {
      if (section.title !== sectionTitle) return section;
      return {
        ...section,
        members: section.members.map((m) =>
          m.name === memberName ? { ...m, boardMemberId, ...(staffId ? { staffId } : {}) } : m
        ),
      };
    });
    this.boardSubject.next({ ...board, sections: updatedSections });
  }

  private toInitials(name: string): string {
    return name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
  }

  private clearActiveBoard(): void {
    this._activeBoardId.next(null);
    this._boardSatisfied.next(false);
    this._boardLoaded.next(true);

    this.boardSubject.next({
      academicYear: '',
      sections: [],
      adviser: {
        name: '',
        position:
          'Publication Adviser',
        initials: '',
      },
    });
  }

  refreshActiveBoard(): void {
    this.loadAdminActiveBoard()
      .subscribe({
        error: error => {
          console.error(
            'Failed to refresh editorial board:',
            error
          );
        },
      });
  }
}
