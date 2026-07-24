import db from "../../config/db";
import { PoolClient } from "pg";

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

function mapApplication(row: any) {
  return {
    id: String(row.id),
    fullName: row.full_name,
    email: row.email,
    studentId: row.student_id,
    yearLevel: row.year_level,
    collegeId: row.college_id,
    programId: row.program_id,
    selectedPositions:
      row.selected_positions ?? [],
    positionId:
      row.position_id ?? undefined,
    subRole:
      row.sub_role ?? undefined,
    motivation: row.motivation,
    status: row.status,
    interviewed:
      row.interviewed ?? false,
    assigned:
      row.assigned ?? false,
    assignedSection:
      row.assigned_section ?? undefined,
    assignedRole:
      row.assigned_role ?? undefined,
    createdAt: row.created_at,
  };
}

function mapStaffMember(row: any) {
  return {
    id: String(row.id),
    applicationId:
      row.application_id
        ? String(row.application_id)
        : undefined,
    fullName: row.full_name,
    email: row.email,
    studentId: row.student_id,
    yearLevel:
      row.year_level ?? undefined,
    collegeId: row.college_id,
    programId: row.program_id,
    positionId: row.position_id,
    subRole:
      row.sub_role ?? undefined,
    assignedSection:
      row.assigned_section ?? undefined,
    assignedRole:
      row.assigned_role ?? undefined,
    createdAt: row.created_at,
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
    const activatedRow = result.rows.find(
      (row: any) => String(row.id) === id
    );

    return activatedRow
      ? mapBoard(activatedRow)
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
export async function revokeMember(
  boardId: string,
  memberId: string
): Promise<boolean> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const memberResult =
      await client.query(
        `
        SELECT
          bm.staff_id,
          sm.application_id
        FROM editorial_board_members bm
        INNER JOIN staff_members sm
          ON sm.id = bm.staff_id
        WHERE bm.id = $1
          AND bm.board_id = $2
        FOR UPDATE
        `,
        [memberId, boardId]
      );

    const memberRow =
      memberResult.rows[0];

    if (!memberRow) {
      await client.query("ROLLBACK");
      return false;
    }

    const staffId =
      String(memberRow.staff_id);

    const applicationId =
      memberRow.application_id
        ? String(memberRow.application_id)
        : null;

    await client.query(
      `
      DELETE FROM editorial_board_members
      WHERE id = $1
        AND board_id = $2
      `,
      [memberId, boardId]
    );

    const remainingResult =
      await client.query(
        `
        SELECT
          section,
          role
        FROM editorial_board_members
        WHERE board_id = $1
          AND staff_id = $2
        ORDER BY created_at ASC, id ASC
        FOR UPDATE
        `,
        [boardId, staffId]
      );

    const remainingAssignment =
      remainingResult.rows[0];

    if (remainingAssignment) {
      const remainingSection =
        String(
          remainingAssignment.section
        );

      const remainingRole =
        String(
          remainingAssignment.role
        );

      await client.query(
        `
        UPDATE staff_members
        SET
          assigned_section = $2,
          assigned_role = $3
        WHERE id = $1
        `,
        [
          staffId,
          remainingSection,
          remainingRole,
        ]
      );

      if (applicationId) {
        await client.query(
          `
          UPDATE applications
          SET
            assigned = true,
            assigned_section = $2,
            assigned_role = $3
          WHERE id = $1
          `,
          [
            applicationId,
            remainingSection,
            remainingRole,
          ]
        );
      }
    } else {
      await client.query(
        `
        UPDATE staff_members
        SET
          assigned_section = NULL,
          assigned_role = NULL
        WHERE id = $1
        `,
        [staffId]
      );

      if (applicationId) {
        await client.query(
          `
          UPDATE applications
          SET
            assigned = false,
            assigned_section = NULL,
            assigned_role = NULL
          WHERE id = $1
          `,
          [applicationId]
        );
      }
    }

    await client.query("COMMIT");

    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type ActiveBoardCreditMember = {
  staffId: string;
  fullName: string;
};


export type AssignApplicationTransactionInput = {
  boardId: string;
  applicationId: string;
  section: string;
  role: string;
  singlePersonRole: boolean;
};

export async function assignApplicationToBoard(
  input: AssignApplicationTransactionInput
) {
  const {
    boardId,
    applicationId,
    section,
    role,
    singlePersonRole,
  } = input;

  const client =
    await db.connect();

  try {
    await client.query("BEGIN");

    const boardResult =
      await client.query(
        `
        SELECT
          id,
          academic_year,
          adviser_name,
          is_active,
          is_satisfied,
          created_at
        FROM editorial_boards
        WHERE id = $1
        FOR UPDATE
        `,
        [boardId]
      );

    const boardRow =
      boardResult.rows[0];

    if (!boardRow) {
      throw httpError(
        "Editorial board not found",
        404
      );
    }

    if (boardRow.is_active !== true) {
      throw httpError(
        "Applications can only be assigned to the active editorial board",
        409
      );
    }

    const applicationResult =
      await client.query(
        `
        SELECT *
        FROM applications
        WHERE id = $1
        FOR UPDATE
        `,
        [applicationId]
      );

    const applicationRow =
      applicationResult.rows[0];

    if (!applicationRow) {
      throw httpError(
        "Application not found",
        404
      );
    }

    if (
      applicationRow.status !==
      "accepted"
    ) {
      throw httpError(
        "Only accepted applications can be assigned to the editorial board",
        409
      );
    }

    if (
      applicationRow.assigned === true
    ) {
      throw httpError(
        "This application has already been assigned",
        409
      );
    }

    let staffResult =
      await client.query(
        `
        SELECT *
        FROM staff_members
        WHERE application_id = $1
        FOR UPDATE
        `,
        [applicationId]
      );

    let staffRow =
      staffResult.rows[0];

    if (!staffRow) {
      staffResult =
        await client.query(
          `
          INSERT INTO staff_members (
            application_id,
            full_name,
            email,
            student_id,
            year_level,
            college_id,
            program_id,
            position_id,
            sub_role,
            assigned_section,
            assigned_role
          )
          SELECT
            id,
            full_name,
            email,
            student_id,
            year_level,
            college_id,
            program_id,
            position_id,
            sub_role,
            $2,
            $3
          FROM applications
          WHERE id = $1
          RETURNING *
          `,
          [
            applicationId,
            section,
            role,
          ]
        );

      staffRow =
        staffResult.rows[0];

      if (!staffRow) {
        throw httpError(
          "Unable to create the staff record from the application",
          500
        );
      }
    }

    const staffId =
      String(staffRow.id);

    const assignmentsResult =
      await client.query(
        `
        SELECT
          id,
          section,
          role
        FROM editorial_board_members
        WHERE board_id = $1
          AND staff_id = $2
        FOR UPDATE
        `,
        [boardId, staffId]
      );

    const assignments =
      assignmentsResult.rows;

    if (assignments.length >= 2) {
      throw httpError(
        "This staff member already holds the maximum of two board positions",
        409
      );
    }

    if (
      assignments.some(
        assignment =>
          assignment.section === section
      )
    ) {
      throw httpError(
        "This staff member is already assigned to the selected section",
        409
      );
    }

    if (
      staffRow.year_level ===
        "4th_year" &&
      assignments.length === 0
    ) {
      throw httpError(
        "Fourth-year staff members cannot receive a new first board assignment",
        409
      );
    }

    if (singlePersonRole) {
      const roleResult =
        await client.query(
          `
          SELECT id
          FROM editorial_board_members
          WHERE board_id = $1
            AND section = $2
            AND role = $3
          LIMIT 1
          FOR UPDATE
          `,
          [
            boardId,
            section,
            role,
          ]
        );

      if (roleResult.rows[0]) {
        throw httpError(
          `"${role}" is already assigned on the active editorial board`,
          409
        );
      }
    }

    const boardMemberResult =
      await client.query(
        `
        INSERT INTO editorial_board_members (
          board_id,
          staff_id,
          section,
          role
        )
        VALUES ($1, $2, $3, $4)
        RETURNING
          id,
          board_id,
          staff_id,
          section,
          role,
          created_at
        `,
        [
          boardId,
          staffId,
          section,
          role,
        ]
      );

    const updatedStaffResult =
      await client.query(
        `
        UPDATE staff_members
        SET
          assigned_section = $2,
          assigned_role = $3
        WHERE id = $1
        RETURNING *
        `,
        [
          staffId,
          section,
          role,
        ]
      );

    const updatedApplicationResult =
      await client.query(
        `
        UPDATE applications
        SET
          assigned = true,
          assigned_section = $2,
          assigned_role = $3
        WHERE id = $1
        RETURNING *
        `,
        [
          applicationId,
          section,
          role,
        ]
      );

    await client.query("COMMIT");

    return {
      board: mapBoard(boardRow),

      application:
        mapApplication(
          updatedApplicationResult
            .rows[0]
        ),

      staff:
        mapStaffMember(
          updatedStaffResult.rows[0]
        ),

      boardMember:
        mapMember(
          boardMemberResult.rows[0]
        ),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    mapAssignmentConstraintError(error);
  } finally {
    client.release();
  }
}

export async function findActiveBoardMembersByStaffIds(
  staffIds: string[]
): Promise<ActiveBoardCreditMember[]> {
  const uniqueIds = [...new Set(staffIds)];

  if (!uniqueIds.length) {
    return [];
  }

  const result = await db.query(
    `SELECT DISTINCT
       sm.id AS staff_id,
       sm.full_name
     FROM editorial_board_members bm
     INNER JOIN editorial_boards eb
       ON eb.id = bm.board_id
     INNER JOIN staff_members sm
       ON sm.id = bm.staff_id
     WHERE eb.is_active = TRUE
       AND sm.id = ANY($1::uuid[])
     ORDER BY sm.full_name ASC`,
    [uniqueIds]
  );

  return result.rows.map(row => ({
    staffId: String(row.staff_id),
    fullName: String(row.full_name),
  }));
}

function httpError(
  message: string,
  statusCode: number
): Error & { statusCode: number } {
  return Object.assign(
    new Error(message),
    { statusCode }
  );
}

function mapAssignmentConstraintError(
  error: unknown
): never {
  const dbError = error as {
    code?: string;
    constraint?: string;
  };

  if (dbError.code !== "23505") {
    throw error;
  }

  switch (dbError.constraint) {
    case "uq_staff_members_application_id":
      throw httpError(
        "A staff record already exists for this application",
        409
      );

    case "uq_editorial_board_member_section":
      throw httpError(
        "This staff member is already assigned to the selected section",
        409
      );

    case "uq_editorial_board_executive_role":
      throw httpError(
        "This Executive Editor role is already assigned",
        409
      );

    default:
      throw httpError(
        "This assignment conflicts with an existing record",
        409
      );
  }
}
