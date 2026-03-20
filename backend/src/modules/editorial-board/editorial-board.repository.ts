import db from "../../config/db";

// ── mappers ──────────────────────────────────────────────────────────────────

function mapBoard(row: any) {
  return {
    id: String(row.id),
    academicYear: row.academic_year,
    adviserName: row.adviser_name,
    isActive: row.is_active as boolean,
    isSatisfied: (row.is_satisfied ?? false) as boolean,
    createdAt: row.created_at,
  };
}

function mapMember(row: any) {
  return {
    id: String(row.id),
    boardId: String(row.board_id),
    staffId: String(row.staff_id),
    section: row.section,
    role: row.role,
    createdAt: row.created_at,
    // joined staff fields (present when queried with JOIN)
    fullName: row.full_name ?? undefined,
    email: row.email ?? undefined,
    yearLevel: row.year_level ?? undefined,
  };
}

// ── editorial_boards ─────────────────────────────────────────────────────────

export async function findAllBoards() {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     ORDER BY created_at DESC`
  );
  return result.rows.map(mapBoard);
}

export async function findBoardById(id: string) {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

export async function findActiveBoard() {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     WHERE is_active = TRUE
     LIMIT 1`
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

/** Atomically sets is_active = true for the given board and false for all others. */
export async function activateBoard(id: string) {
  const result = await db.query(
    `UPDATE editorial_boards
     SET is_active = (id = $1)
     WHERE TRUE
     RETURNING id, academic_year, adviser_name, is_active, is_satisfied, created_at`,
    [id]
  );
  return result.rows.find((r: any) => String(r.id) === id)
    ? mapBoard(result.rows.find((r: any) => String(r.id) === id))
    : undefined;
}

export async function findBoardByAcademicYear(academicYear: string) {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     WHERE LOWER(TRIM(academic_year)) = LOWER(TRIM($1))
     LIMIT 1`,
    [academicYear]
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

export async function createBoard(academicYear: string, adviserName: string) {
  const result = await db.query(
    `INSERT INTO editorial_boards (academic_year, adviser_name, is_active, is_satisfied)
     VALUES ($1, $2, FALSE, FALSE)
     RETURNING id, academic_year, adviser_name, is_active, is_satisfied, created_at`,
    [academicYear, adviserName]
  );
  return mapBoard(result.rows[0]);
}

export async function removeBoard(id: string) {
  // Explicitly remove child rows first in case ON DELETE CASCADE
  // was not applied to the existing table (pre-migration databases).
  await db.query(
    `DELETE FROM editorial_board_members WHERE board_id = $1`,
    [id]
  );
  const result = await db.query(
    `DELETE FROM editorial_boards WHERE id = $1 RETURNING id`,
    [id]
  );
  return result.rows[0] ?? undefined;
}

/** Sets is_satisfied for a board (persisted to DB). */
export async function satisfyBoard(id: string, satisfied: boolean) {
  const result = await db.query(
    `UPDATE editorial_boards
     SET is_satisfied = $2
     WHERE id = $1
     RETURNING id, academic_year, adviser_name, is_active, is_satisfied, created_at`,
    [id, satisfied]
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

// ── board_members ─────────────────────────────────────────────────────────────

export async function findMembersByBoard(boardId: string) {
  const result = await db.query(
    `SELECT bm.id, bm.board_id, bm.staff_id, bm.section, bm.role, bm.created_at,
            sm.full_name, sm.email, sm.year_level
     FROM editorial_board_members bm
     JOIN staff_members sm ON sm.id = bm.staff_id
     WHERE bm.board_id = $1
     ORDER BY bm.created_at ASC`,
    [boardId]
  );
  return result.rows.map(mapMember);
}

export async function findMemberById(memberId: string) {
  const result = await db.query(
    `SELECT bm.id, bm.board_id, bm.staff_id, bm.section, bm.role, bm.created_at,
            sm.full_name, sm.email, sm.year_level
     FROM editorial_board_members bm
     JOIN staff_members sm ON sm.id = bm.staff_id
     WHERE bm.id = $1`,
    [memberId]
  );
  return result.rows[0] ? mapMember(result.rows[0]) : undefined;
}

export async function addMember(boardId: string, staffId: string, section: string, role: string) {
  const result = await db.query(
    `INSERT INTO editorial_board_members (board_id, staff_id, section, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, board_id, staff_id, section, role, created_at`,
    [boardId, staffId, section, role]
  );
  return mapMember(result.rows[0]);
}

export async function removeMember(memberId: string) {
  const result = await db.query(
    `DELETE FROM editorial_board_members WHERE id = $1 RETURNING id`,
    [memberId]
  );
  return result.rows[0] ?? undefined;
}

export async function updateMember(boardId: string, memberId: string, section: string, role: string) {
  const updateResult = await db.query(
    `UPDATE editorial_board_members
     SET section = $3,
         role    = $4
     WHERE id = $2 AND board_id = $1
     RETURNING staff_id`,
    [boardId, memberId, section, role]
  );

  if (!updateResult.rowCount || updateResult.rowCount === 0) {
    return undefined;
  }

  const staffId: string = updateResult.rows[0].staff_id;

  // Keep staff_members and applications assignment fields in sync.
  await db.query(
    `UPDATE staff_members
     SET assigned_section = $2,
         assigned_role    = $3
     WHERE id = $1`,
    [staffId, section, role]
  );

  await db.query(
    `UPDATE applications
     SET assigned_section = $2,
         assigned_role    = $3
     WHERE id = (SELECT application_id FROM staff_members WHERE id = $1 AND application_id IS NOT NULL)`,
    [staffId, section, role]
  );

  return findMemberById(memberId);
}

/**
 * Revoke: removes the member from the board and resets the linked application
 * back to assigned=false so they re-appear in the assignment queue,
 * but does NOT delete the staff_members record.
 */
export async function revokeMember(boardId: string, memberId: string) {
  // Get staff_id before deleting
  const memberResult = await db.query(
    `SELECT staff_id FROM editorial_board_members WHERE id = $1 AND board_id = $2`,
    [memberId, boardId]
  );
  if (!memberResult.rows[0]) return false;

  const staffId: string = memberResult.rows[0].staff_id;

  // Remove from board
  await db.query(
    `DELETE FROM editorial_board_members WHERE id = $1`,
    [memberId]
  );

  // Reset the linked application assignment fields (keep status = 'accepted')
  await db.query(
    `UPDATE applications
     SET assigned         = false,
         assigned_section = NULL,
         assigned_role    = NULL
     WHERE id = (SELECT application_id FROM staff_members WHERE id = $1 AND application_id IS NOT NULL)`,
    [staffId]
  );

  return true;
}
