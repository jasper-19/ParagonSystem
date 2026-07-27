import db from "../../config/db";
import {
  deriveNextBoardStaffLifecycle,
  shouldApplyStaffTransition,
} from "./editorial-board-transition";

// ── mappers ──────────────────────────────────────────────────────────────────

function mapBoard(row: any) {
  return {
    id: String(row.id),
    academicYear: row.academic_year,
    adviserName: row.adviser_name,
    coAdviserName: row.co_adviser_name ?? "",
    isActive: row.is_active as boolean,
    isSatisfied: (row.is_satisfied ?? false) as boolean,
    staffTransitionAppliedAt:
      row.staff_transition_applied_at ?? undefined,
    transitionFromBoardId:
      row.transition_from_board_id
        ? String(row.transition_from_board_id)
        : undefined,
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
    isBoardEligible:
      (row.is_board_eligible ?? true) as boolean,
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
    isBoardEligible:
      (row.is_board_eligible ?? true) as boolean,
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
    `SELECT id, academic_year, adviser_name, co_adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     ORDER BY created_at DESC`
  );
  return result.rows.map(mapBoard);
}

export async function findBoardById(id: string) {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, co_adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     WHERE id = $1`,
    [id]
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

export async function findActiveBoard() {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, co_adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     WHERE is_active = TRUE
     LIMIT 1`
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

/**
 * Activates a board and applies the one-time staff year-level transition from
 * the current board when the target academic year is newer.
 *
 * A transaction-scoped advisory lock serializes this low-frequency,
 * application-level operation. The transaction markers on both the target
 * board and affected staff make retries idempotent.
 */
export async function activateBoard(id: string) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('editorial_board_activation'))"
    );

    const targetResult = await client.query(
      `SELECT *
       FROM editorial_boards
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );
    const targetRow = targetResult.rows[0];

    if (!targetRow) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const currentResult = await client.query(
      `SELECT *
       FROM editorial_boards
       WHERE is_active = TRUE
       ORDER BY id
       FOR UPDATE`
    );
    const currentRow = currentResult.rows.find(
      (row: any) => String(row.id) !== id
    );

    const shouldApplyTransition =
      Boolean(currentRow) &&
      shouldApplyStaffTransition({
        currentAcademicYear:
          currentRow?.academic_year,
        targetAcademicYear:
          targetRow.academic_year,
        targetTransitionAppliedAt:
          targetRow.staff_transition_applied_at,
      });

    let promotedCount = 0;
    let graduatedCount = 0;

    if (shouldApplyTransition) {
      const transitionResult = await client.query(
        `WITH transition_candidates AS (
           SELECT
             sm.id,
             sm.year_level AS previous_year_level
           FROM staff_members sm
           WHERE EXISTS (
               SELECT 1
               FROM editorial_board_members ebm
               WHERE ebm.staff_id = sm.id
                 AND ebm.board_id = $1
             )
             AND sm.last_year_level_transition_academic_year
                   IS DISTINCT FROM $2
           ORDER BY sm.id
           FOR UPDATE OF sm
         )
         UPDATE staff_members sm
         SET year_level = CASE transition_candidates.previous_year_level
               WHEN '1st_year' THEN '2nd_year'
               WHEN '2nd_year' THEN '3rd_year'
               WHEN '3rd_year' THEN '4th_year'
               ELSE sm.year_level
             END,
             is_board_eligible = CASE
               WHEN transition_candidates.previous_year_level = '4th_year'
                 THEN FALSE
               ELSE sm.is_board_eligible
             END,
             graduated_at = CASE
               WHEN transition_candidates.previous_year_level = '4th_year'
                 THEN COALESCE(sm.graduated_at, NOW())
               ELSE sm.graduated_at
             END,
             last_year_level_transition_academic_year = $2
         FROM transition_candidates
         WHERE sm.id = transition_candidates.id
         RETURNING transition_candidates.previous_year_level`,
        [currentRow.id, targetRow.academic_year]
      );

      promotedCount = transitionResult.rows.filter(
        (row: any) =>
          row.previous_year_level === "1st_year" ||
          row.previous_year_level === "2nd_year" ||
          row.previous_year_level === "3rd_year"
      ).length;
      graduatedCount = transitionResult.rows.filter(
        (row: any) => row.previous_year_level === "4th_year"
      ).length;

      await client.query(
        `UPDATE editorial_boards
         SET staff_transition_applied_at = NOW(),
             transition_from_board_id = $2
         WHERE id = $1`,
        [id, currentRow.id]
      );
    }

    const activationResult = await client.query(
      `UPDATE editorial_boards
       SET is_active = (id = $1)
       WHERE is_active = TRUE OR id = $1
       RETURNING *`,
      [id]
    );
    const activatedRow = activationResult.rows.find(
      (row: any) => String(row.id) === id
    );

    await client.query("COMMIT");

    if (!activatedRow) {
      return undefined;
    }

    return {
      ...mapBoard(activatedRow),
      yearLevelTransition: {
        applied: shouldApplyTransition,
        fromBoardId: shouldApplyTransition
          ? String(currentRow.id)
          : undefined,
        promotedCount,
        graduatedCount,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findBoardByAcademicYear(academicYear: string) {
  const result = await db.query(
    `SELECT id, academic_year, adviser_name, co_adviser_name, is_active, is_satisfied, created_at
     FROM editorial_boards
     WHERE LOWER(
       REPLACE(TRIM(academic_year), '–', '-')
     ) = LOWER(
       REPLACE(TRIM($1), '–', '-')
     )
     LIMIT 1`,
    [academicYear]
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

export async function createBoard(
  academicYear: string,
  adviserName: string,
  coAdviserName?: string
) {
  const result = await db.query(
    `INSERT INTO editorial_boards
       (academic_year, adviser_name, co_adviser_name, is_active, is_satisfied)
     VALUES ($1, $2, $3, FALSE, FALSE)
     RETURNING id, academic_year, adviser_name, co_adviser_name, is_active, is_satisfied, created_at`,
    [academicYear, adviserName, coAdviserName || null]
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
     RETURNING id, academic_year, adviser_name, co_adviser_name, is_active, is_satisfied, created_at`,
    [id, satisfied]
  );
  return result.rows[0] ? mapBoard(result.rows[0]) : undefined;
}

// ── board_members ─────────────────────────────────────────────────────────────

export async function findMembersByBoard(boardId: string) {
  const result = await db.query(
    `SELECT bm.id, bm.board_id, bm.staff_id, bm.section, bm.role, bm.created_at,
            sm.full_name, sm.email,
            COALESCE(bm.year_level_at_assignment, sm.year_level) AS year_level
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
            sm.full_name, sm.email,
            COALESCE(bm.year_level_at_assignment, sm.year_level) AS year_level
     FROM editorial_board_members bm
     JOIN staff_members sm ON sm.id = bm.staff_id
     WHERE bm.id = $1`,
    [memberId]
  );
  return result.rows[0] ? mapMember(result.rows[0]) : undefined;
}

export async function addMember(boardId: string, staffId: string, section: string, role: string) {
  const result = await db.query(
    `INSERT INTO editorial_board_members
       (board_id, staff_id, section, role, year_level_at_assignment)
     SELECT $1, sm.id, $3, $4, sm.year_level
     FROM staff_members sm
     WHERE sm.id = $2
       AND (
         sm.is_board_eligible = TRUE
         OR EXISTS (
           SELECT 1
           FROM editorial_board_members existing
           WHERE existing.board_id = $1
             AND existing.staff_id = sm.id
         )
       )
     RETURNING id, board_id, staff_id, section, role,
               year_level_at_assignment AS year_level, created_at`,
    [boardId, staffId, section, role]
  );
  return result.rows[0]
    ? mapMember(result.rows[0])
    : undefined;
}

export async function removeMember(memberId: string) {
  const result = await db.query(
    `DELETE FROM editorial_board_members WHERE id = $1 RETURNING id`,
    [memberId]
  );
  return result.rows[0] ?? undefined;
}

export async function updateMember(
  boardId: string,
  memberId: string,
  section: string,
  role: string,
  yearLevel?: string | null
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const memberResult = await client.query(
      `SELECT staff_id
       FROM editorial_board_members
       WHERE id = $2 AND board_id = $1
       FOR UPDATE`,
      [boardId, memberId]
    );
    const memberRow = memberResult.rows[0];

    if (!memberRow) {
      await client.query("ROLLBACK");
      return undefined;
    }

    const staffId = String(memberRow.staff_id);
    const yearLevelWasProvided = yearLevel !== undefined;

    await client.query(
      `UPDATE editorial_board_members
       SET section = $3,
           role = $4,
           year_level_at_assignment = CASE
             WHEN $5::boolean THEN $6::varchar
             ELSE year_level_at_assignment
           END
       WHERE id = $2 AND board_id = $1`,
      [
        boardId,
        memberId,
        section,
        role,
        yearLevelWasProvided,
        yearLevel ?? null,
      ]
    );

    let derivedCurrentYearLevel:
      string | null | undefined = undefined;
    let derivedEligibility:
      boolean | undefined = undefined;
    let transitionAcademicYear:
      string | undefined = undefined;

    if (yearLevelWasProvided) {
      const transitionResult = await client.query(
        `SELECT academic_year
         FROM editorial_boards
         WHERE transition_from_board_id = $1
           AND staff_transition_applied_at IS NOT NULL
         ORDER BY staff_transition_applied_at DESC
         LIMIT 1
         FOR UPDATE`,
        [boardId]
      );
      transitionAcademicYear =
        transitionResult.rows[0]?.academic_year;

      if (transitionAcademicYear) {
        const lifecycle =
          deriveNextBoardStaffLifecycle(
            yearLevel ?? null
          );
        derivedCurrentYearLevel =
          lifecycle.yearLevel;
        derivedEligibility =
          lifecycle.isBoardEligible;
      } else {
        derivedCurrentYearLevel = yearLevel ?? null;
      }
    }

    await client.query(
      `UPDATE staff_members
       SET assigned_section = $2,
           assigned_role = $3,
           year_level = CASE
             WHEN $4::boolean THEN $5::varchar
             ELSE year_level
           END,
           is_board_eligible = CASE
             WHEN $6::boolean THEN $7::boolean
             ELSE is_board_eligible
           END,
           graduated_at = CASE
             WHEN $6::boolean AND $7::boolean = FALSE
               THEN COALESCE(graduated_at, NOW())
             WHEN $6::boolean AND $7::boolean = TRUE
               THEN NULL
             ELSE graduated_at
           END,
           last_year_level_transition_academic_year = CASE
             WHEN $8::boolean THEN $9::varchar
             ELSE last_year_level_transition_academic_year
           END
       WHERE id = $1`,
      [
        staffId,
        section,
        role,
        derivedCurrentYearLevel !== undefined,
        derivedCurrentYearLevel ?? null,
        derivedEligibility !== undefined,
        derivedEligibility ?? false,
        transitionAcademicYear !== undefined,
        transitionAcademicYear ?? null,
      ]
    );

    await client.query(
      `UPDATE applications
       SET assigned_section = $2,
           assigned_role = $3
       WHERE id = (
         SELECT application_id
         FROM staff_members
         WHERE id = $1
           AND application_id IS NOT NULL
       )`,
      [staffId, section, role]
    );

    const updatedResult = await client.query(
      `SELECT bm.id, bm.board_id, bm.staff_id, bm.section, bm.role,
              bm.created_at, sm.full_name, sm.email,
              COALESCE(
                bm.year_level_at_assignment,
                sm.year_level
              ) AS year_level
       FROM editorial_board_members bm
       JOIN staff_members sm ON sm.id = bm.staff_id
       WHERE bm.id = $1`,
      [memberId]
    );

    await client.query("COMMIT");
    return updatedResult.rows[0]
      ? mapMember(updatedResult.rows[0])
      : undefined;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
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
          co_adviser_name,
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
      staffRow.is_board_eligible === false &&
      assignments.length === 0
    ) {
      throw httpError(
        "This staff member is no longer eligible for editorial-board assignment",
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
          role,
          year_level_at_assignment
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          board_id,
          staff_id,
          section,
          role,
          year_level_at_assignment AS year_level,
          created_at
        `,
        [
          boardId,
          staffId,
          section,
          role,
          staffRow.year_level,
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
