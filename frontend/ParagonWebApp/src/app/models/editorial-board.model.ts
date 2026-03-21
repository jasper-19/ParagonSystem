/* ================= MODELS ================= */

export interface BoardMember {
  name: string;
  position: string;
  initials?: string;
  image?: string;
  /** editorial_board_members.id — present for DB-backed members */
  boardMemberId?: string;
  /** staff_members.id — present for DB-backed members */
  staffId?: string;
  yearLevel?: string;
}

export interface BoardSection {
  title: string;
  members: BoardMember[];
}

export interface EditorialBoardData {
  academicYear: string;
  sections: BoardSection[];
  adviser: BoardMember;
}

export interface EditorialBoardMember {
  id: string;

  name: string;

  section: string;
  role: string;

  initials? : string;
  image?: string;

  joinedAt: Date;
}

/** Matches the board_members row returned by the backend (joined with staff_members) */
export interface ApiBoardMember {
  id: string;
  boardId: string;
  staffId: string;
  section: string;
  role: string;
  fullName?: string;
  email?: string;
  yearLevel?: string;
  createdAt: string;
}

/** Matches GET /api/editorial-boards/active response */
export interface ApiActiveBoard {
  id: string;
  academicYear: string;
  adviserName: string;
  isActive: boolean;
  isSatisfied: boolean;
  createdAt: string;
  members: ApiBoardMember[];
}

/** Matches a single item in GET /api/editorial-boards list response */
export interface ApiBoard {
  id: string;
  academicYear: string;
  adviserName: string;
  isActive: boolean;
  isSatisfied: boolean;
  createdAt: string;
}
