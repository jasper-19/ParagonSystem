import db from "../../config/db";
import { User, AuthStaffProfile, UserWithStaff } from "./user.types";

function mapRow(row: any): User {
  const base: User = {
    id: String(row.id),
    username: row.username,
    passwordHash: row.password_hash,
    role: row.role,
  };

  return {
    ...base,
    ...(row.staff_id ? { staffId: String(row.staff_id) } : {}),
    ...(row.two_fa_enabled !== undefined && row.two_fa_enabled !== null
      ? { twoFaEnabled: Boolean(row.two_fa_enabled) }
      : {}),
    ...(row.last_login_at ? { lastLoginAt: new Date(row.last_login_at) } : {}),
    ...(row.created_at ? { createdAt: new Date(row.created_at) } : {}),
    ...(row.updated_at ? { updatedAt: new Date(row.updated_at) } : {}),
  };
}

function mapJoinedStaff(
  row: any
): AuthStaffProfile | null {
  if (!row.staff_profile_id) {
    return null;
  }

  return {
    id:
      String(
        row.staff_profile_id
      ),

    ...(
      row.staff_application_id
        ? {
            applicationId:
              String(
                row.staff_application_id
              ),
          }
        : {}
    ),

    fullName:
      String(
        row.staff_full_name ??
        ""
      ),

    email:
      String(
        row.staff_email ??
        ""
      ),

    ...(
      row.staff_student_id
        ? {
            studentId:
              String(
                row.staff_student_id
              ),
          }
        : {}
    ),

    ...(
      row.staff_year_level
        ? {
            yearLevel:
              String(
                row.staff_year_level
              ),
          }
        : {}
    ),

    ...(
      row.staff_college_id
        ? {
            collegeId:
              String(
                row.staff_college_id
              ),
          }
        : {}
    ),

    ...(
      row.staff_program_id
        ? {
            programId:
              String(
                row.staff_program_id
              ),
          }
        : {}
    ),

    ...(
      row.staff_position_id
        ? {
            positionId:
              String(
                row.staff_position_id
              ),
          }
        : {}
    ),

    ...(
      row.staff_sub_role
        ? {
            subRole:
              String(
                row.staff_sub_role
              ),
          }
        : {}
    ),

    ...(
      row.staff_assigned_section
        ? {
            assignedSection:
              String(
                row.staff_assigned_section
              ),
          }
        : {}
    ),

    ...(
      row.staff_assigned_role
        ? {
            assignedRole:
              String(
                row.staff_assigned_role
              ),
          }
        : {}
    ),

    ...(
      row.staff_created_at
        ? {
            createdAt:
              new Date(
                row.staff_created_at
              ),
          }
        : {}
    ),
  };
}

export async function findByUsername(username: string): Promise<User | undefined> {
  const result = await db.query(
    `SELECT *
     FROM users
     WHERE username = $1`,
    [username]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function findById(id: string): Promise<User | undefined> {
  const result = await db.query(
    `SELECT *
     FROM users
     WHERE id = $1`,
    [id]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function findByIdWithStaff(
  id: string
): Promise<UserWithStaff | undefined> {
  const result =
    await db.query(
      `SELECT
         u.id,
         u.username,
         u.password_hash,
         u.role,
         u.staff_id,
         u.two_fa_enabled,
         u.last_login_at,
         u.created_at,
         u.updated_at,

         sm.id
           AS staff_profile_id,

         sm.application_id
           AS staff_application_id,

         sm.full_name
           AS staff_full_name,

         sm.email
           AS staff_email,

         sm.student_id
           AS staff_student_id,

         sm.year_level
           AS staff_year_level,

         sm.college_id
           AS staff_college_id,

         sm.program_id
           AS staff_program_id,

         sm.position_id
           AS staff_position_id,

         sm.sub_role
           AS staff_sub_role,

         sm.assigned_section
           AS staff_assigned_section,

         sm.assigned_role
           AS staff_assigned_role,

         sm.created_at
           AS staff_created_at

       FROM users u

       LEFT JOIN staff_members sm
         ON sm.id = u.staff_id

       WHERE u.id = $1

       LIMIT 1`,
      [id]
    );

  const row =
    result.rows[0];

  if (!row) {
    return undefined;
  }

  return {
    user:
      mapRow(row),

    staff:
      mapJoinedStaff(row),
  };
}

export async function listAll(): Promise<User[]> {
  const result = await db.query(
    `SELECT *
     FROM users
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapRow);
}

export async function create(input: {
  username: string;
  passwordHash: string;
  role: string;
  staffId?: string;
}): Promise<User> {
  const result = await db.query(
    `INSERT INTO users (username, password_hash, role, staff_id)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.username, input.passwordHash, input.role, input.staffId ?? null]
  );

  return mapRow(result.rows[0]);
}

export async function updateUser(
  id: string,
  patch: Partial<{
    passwordHash: string;
    role: string;
    staffId: string | null;
    twoFaEnabled: boolean;
  }>
): Promise<User | undefined> {
  const sets: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (patch.passwordHash !== undefined) {
    sets.push(`password_hash = $${idx++}`);
    values.push(patch.passwordHash);
  }
  if (patch.role !== undefined) {
    sets.push(`role = $${idx++}`);
    values.push(patch.role);
  }
  if (patch.staffId !== undefined) {
    sets.push(`staff_id = $${idx++}`);
    values.push(patch.staffId);
  }
  if (patch.twoFaEnabled !== undefined) {
    sets.push(`two_fa_enabled = $${idx++}`);
    values.push(patch.twoFaEnabled);
  }

  if (sets.length === 0) return await findById(id);

  sets.push(`updated_at = NOW()`);
  values.push(id);

  const result = await db.query(
    `UPDATE users
     SET ${sets.join(", ")}
     WHERE id = $${idx}
     RETURNING *`,
    values
  );

  return result.rows[0] ? mapRow(result.rows[0]) : undefined;
}

export async function setLastLogin(id: string): Promise<void> {
  await db.query(`UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
}
