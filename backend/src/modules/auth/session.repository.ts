import db from "../../config/db";
import { UserSession } from "./session.types";

function mapRow(row: any): UserSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    ...(row.user_agent ? { userAgent: String(row.user_agent) } : {}),
    ...(row.ip_address ? { ipAddress: String(row.ip_address) } : {}),
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    lastActiveAt: row.last_active_at ? new Date(row.last_active_at) : new Date(),
    ...(row.revoked_at ? { revokedAt: new Date(row.revoked_at) } : {}),
  };
}

export async function createSession(input: {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<UserSession> {
  const result = await db.query(
    `INSERT INTO user_sessions (user_id, user_agent, ip_address)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [input.userId, input.userAgent ?? null, input.ipAddress ?? null]
  );
  return mapRow(result.rows[0]);
}

export async function listSessionsByUser(userId: string): Promise<UserSession[]> {
  const result = await db.query(
    `SELECT *
     FROM user_sessions
     WHERE user_id = $1
     ORDER BY COALESCE(last_active_at, created_at) DESC`,
    [userId]
  );
  return result.rows.map(mapRow);
}

export async function revokeSession(userId: string, sessionId: string): Promise<void> {
  await db.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
    [sessionId, userId]
  );
}

export async function revokeAllOtherSessions(
  userId: string,
  keepSessionId?: string
): Promise<void> {
  if (keepSessionId) {
    await db.query(
      `UPDATE user_sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND id <> $2 AND revoked_at IS NULL`,
      [userId, keepSessionId]
    );
    return;
  }

  await db.query(
    `UPDATE user_sessions
     SET revoked_at = NOW()
     WHERE user_id = $1 AND revoked_at IS NULL`,
    [userId]
  );
}

export async function touchSession(sessionId: string): Promise<void> {
  await db.query(
    `UPDATE user_sessions
     SET last_active_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId]
  );
}

export async function isSessionActive(sessionId: string): Promise<boolean> {
  const result = await db.query(
    `SELECT 1
     FROM user_sessions
     WHERE id = $1 AND revoked_at IS NULL`,
    [sessionId]
  );
  return !!result.rows[0];
}

