import db from "../../config/db";
import { User } from "./user.types";

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
