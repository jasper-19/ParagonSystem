import db from "../../config/db";
import { UserSession, CreateUserSessionInput, SessionMetadataPatch } from "./session.types";


function mapRow(
  row: any
): UserSession {
  return {
    id:
      String(row.id),

    userId:
      String(row.user_id),

    ...(row.user_agent
      ? {
          userAgent:
            String(row.user_agent),
        }
      : {}),

    ...(row.ip_address
      ? {
          ipAddress:
            String(row.ip_address),
        }
      : {}),

    ...(row.browser_name
      ? {
          browserName:
            String(row.browser_name),
        }
      : {}),

    ...(row.browser_version
      ? {
          browserVersion:
            String(row.browser_version),
        }
      : {}),

    ...(row.os_name
      ? {
          osName:
            String(row.os_name),
        }
      : {}),

    ...(row.os_version
      ? {
          osVersion:
            String(row.os_version),
        }
      : {}),

    ...(row.device_type
      ? {
          deviceType:
            String(row.device_type),
        }
      : {}),

    createdAt:
      row.created_at
        ? new Date(row.created_at)
        : new Date(),

    lastActiveAt:
      row.last_active_at
        ? new Date(row.last_active_at)
        : new Date(),

    ...(row.revoked_at
      ? {
          revokedAt:
            new Date(row.revoked_at),
        }
      : {}),
  };
}

export async function createSession(
  input: CreateUserSessionInput
): Promise<UserSession> {
  const result =
    await db.query(
      `INSERT INTO user_sessions (
         user_id,
         user_agent,
         ip_address,
         browser_name,
         browser_version,
         os_name,
         os_version,
         device_type
       )
       VALUES (
         $1,
         $2,
         $3,
         $4,
         $5,
         $6,
         $7,
         $8
       )
       RETURNING *`,
      [
        input.userId,
        input.userAgent ?? null,
        input.ipAddress ?? null,
        input.browserName ?? null,
        input.browserVersion ?? null,
        input.osName ?? null,
        input.osVersion ?? null,
        input.deviceType ?? null,
      ]
    );

  return mapRow(
    result.rows[0]
  );
}

export async function findReusableSession(input: {
  userId: string;
  userAgent?: string;
  ipAddress?: string;
}): Promise<UserSession | null> {
  const result = await db.query(
    `SELECT *
     FROM user_sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND user_agent IS NOT DISTINCT FROM $2
       AND ip_address IS NOT DISTINCT FROM $3
       AND COALESCE(last_active_at, created_at) >= NOW() - INTERVAL '8 hours'
     ORDER BY COALESCE(last_active_at, created_at) DESC
     LIMIT 1`,
    [input.userId, input.userAgent ?? null, input.ipAddress ?? null]
  );

  return result.rows[0] ? mapRow(result.rows[0]) : null;
}

export async function listSessionsByUser(
  userId: string,
  currentSessionId?: string
): Promise<UserSession[]> {
  const result = await db.query(
    `SELECT *
     FROM user_sessions
     WHERE user_id = $1
       AND revoked_at IS NULL
       AND COALESCE(last_active_at, created_at) >= NOW() - INTERVAL '8 hours'
     ORDER BY
       CASE WHEN id = $2 THEN 0 ELSE 1 END,
       COALESCE(last_active_at, created_at) DESC`,
    [userId, currentSessionId ?? null]
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
     WHERE id = $1
      AND revoked_at IS NULL
      AND COALESCE(last_active_at, created_at) >= NOW() - INTERVAL '8 hours'`,
    [sessionId]
  );
  return !!result.rows[0];
}

export async function validateAndTouchSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const result = await db.query(
    `UPDATE user_sessions
     SET last_active_at = NOW()
     WHERE id = $1
       AND user_id = $2
       AND revoked_at IS NULL
       AND COALESCE(
         last_active_at,
         created_at
       ) >= NOW() - INTERVAL '8 hours'
     RETURNING id`,
    [
      sessionId,
      userId,
    ]
  );

  return Boolean(
    result.rows[0]
  );
}

export async function updateSessionMetadata(
  sessionId: string,
  metadata: SessionMetadataPatch
): Promise<UserSession | undefined> {
  const result =
    await db.query(
      `UPDATE user_sessions
       SET browser_name = $2,
           browser_version = $3,
           os_name = $4,
           os_version = $5,
           device_type = $6,
           last_active_at = NOW()
       WHERE id = $1
         AND revoked_at IS NULL
       RETURNING *`,
      [
        sessionId,
        metadata.browserName ?? null,
        metadata.browserVersion ?? null,
        metadata.osName ?? null,
        metadata.osVersion ?? null,
        metadata.deviceType,
      ]
    );

  return result.rows[0]
    ? mapRow(result.rows[0])
    : undefined;
}
