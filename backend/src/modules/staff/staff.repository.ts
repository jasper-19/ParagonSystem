import db from "../../config/db";

function mapRow(row: any) {
  return {
    id: String(row.id),
    applicationId: row.application_id ? String(row.application_id) : undefined,
    fullName: row.full_name,
    email: row.email,
    studentId: row.student_id,
    yearLevel: row.year_level ?? undefined,
    collegeId: row.college_id,
    programId: row.program_id,
    positionId: row.position_id,
    subRole: row.sub_role ?? undefined,
    assignedSection: row.assigned_section ?? undefined,
    assignedRole: row.assigned_role ?? undefined,
    createdAt: row.created_at,
  };
}

export async function findAll() {
  const result = await db.query(
    `SELECT *
     FROM staff_members
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapRow);
}

/**
 * Returns only staff members eligible for a new editorial board:
 * excludes anyone whose year_level is '4th_year'.
 */
export async function findEligibleForBoard() {
  const result = await db.query(
    `SELECT *
     FROM staff_members
     WHERE year_level IS DISTINCT FROM '4th_year'
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapRow);
}

export async function findById(id: string) {
  const result = await db.query(
    `SELECT *
     FROM staff_members
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function createFromApplication(
  applicationId: string,
  section: string,
  role: string
) {
  const result = await db.query(
    `
    INSERT INTO staff_members
    (
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
    [applicationId, section, role]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function remove(id: string) {
  // Step 1: remove any board memberships for this staff member (FK safety)
  await db.query(
    `DELETE FROM editorial_board_members WHERE staff_id = $1`,
    [id]
  );

  // Step 2: delete the staff member and capture the linked application_id
  const deleteResult = await db.query(
    `DELETE FROM staff_members WHERE id = $1 RETURNING application_id`,
    [id]
  );

  if (!deleteResult.rowCount || deleteResult.rowCount === 0) {
    return false; // staff member not found
  }

  // Step 2: if there was a linked application, reset its assignment state
  const applicationId: string | null = deleteResult.rows[0]?.application_id ?? null;
  if (applicationId) {
    await db.query(
      `UPDATE applications
       SET status           = 'accepted',
           assigned         = false,
           assigned_section = NULL,
           assigned_role    = NULL
       WHERE id = $1`,
      [applicationId]
    );
  }

  return true;
}

type StaffPatch = Partial<{
  fullName: string;
  email: string;
  studentId: string | null;
  yearLevel: string | null;
  collegeId: string | null;
  programId: string | null;
  positionId: string | null;
  subRole: string | null;
  assignedSection: string | null;
  assignedRole: string | null;
}>;

export async function updateById(id: string, patch: StaffPatch) {
  const allowed: Array<[keyof StaffPatch, string]> = [
    ["fullName", "full_name"],
    ["email", "email"],
    ["studentId", "student_id"],
    ["yearLevel", "year_level"],
    ["collegeId", "college_id"],
    ["programId", "program_id"],
    ["positionId", "position_id"],
    ["subRole", "sub_role"],
    ["assignedSection", "assigned_section"],
    ["assignedRole", "assigned_role"],
  ];

  const setClauses: string[] = [];
  const values: any[] = [id];

  for (const [key, column] of allowed) {
    if (!(key in (patch ?? {}))) continue;
    // Preserve explicit nulls (allows clearing fields).
    const nextValue = (patch as any)[key];
    values.push(typeof nextValue === "string" ? nextValue.trim() : nextValue);
    setClauses.push(`${column} = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return findById(id);
  }

  const result = await db.query(
    `UPDATE staff_members
     SET ${setClauses.join(", ")}
     WHERE id = $1
     RETURNING *`,
    values
  );

  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}
