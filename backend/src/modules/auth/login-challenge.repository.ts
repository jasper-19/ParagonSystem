import { createHash, randomBytes } from 'node:crypto';
import db from '../../config/db';

export type ChallengeKind = 'oauth' | 'google-link' | 'email';
export interface LoginChallenge {
  id: string;
  kind: ChallengeKind;
  data: Record<string, string>;
  user_id: string | null;
  attempts: number;
  code_hash: string | null;
}

export function challengeId(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createChallenge(
  kind: ChallengeKind, data: Record<string, string>, userId?: string
): Promise<{ token: string; id: string }> {
  const token = randomBytes(32).toString('base64url');
  const id = challengeId(token);
  // Bounded opportunistic cleanup; no live challenge is removed.
  await db.query(`DELETE FROM paragon_internal.login_challenges WHERE id IN (
    SELECT id FROM paragon_internal.login_challenges WHERE expires_at < NOW() LIMIT 100)`);
  await db.query(`INSERT INTO paragon_internal.login_challenges (id, kind, data, user_id, expires_at)
    VALUES ($1, $2, $3::jsonb, $4, NOW() + INTERVAL '10 minutes')`,
    [id, kind, JSON.stringify(data), userId ?? null]);
  return { token, id };
}

export async function getChallenge(id: string): Promise<LoginChallenge | undefined> {
  const result = await db.query(`SELECT * FROM paragon_internal.login_challenges
    WHERE id = $1 AND consumed_at IS NULL AND expires_at > NOW() AND attempts < 5`, [id]);
  return result.rows[0];
}

export async function cancelChallenge(id: string): Promise<void> {
  await db.query(`DELETE FROM paragon_internal.login_challenges WHERE id = $1`, [id]);
}

// Consuming OAuth state precedes contacting Google; retries cannot replay a callback.
export async function consumeOAuth(id: string, state: string): Promise<LoginChallenge | undefined> {
  const result = await db.query(`UPDATE paragon_internal.login_challenges SET consumed_at = NOW()
    WHERE id = $1 AND kind = 'oauth' AND data->>'state' = $2
      AND consumed_at IS NULL AND expires_at > NOW() RETURNING *`, [id, state]);
  return result.rows[0];
}

// A failed password check also spends the pending link's finite attempt budget.
export async function attemptLink(id: string): Promise<LoginChallenge | undefined> {
  const result = await db.query(`UPDATE paragon_internal.login_challenges SET attempts = attempts + 1
    WHERE id = $1 AND kind = 'google-link' AND consumed_at IS NULL
      AND expires_at > NOW() AND attempts < 5 RETURNING *`, [id]);
  return result.rows[0];
}

export async function consumeLink(id: string): Promise<boolean> {
  const result = await db.query(`UPDATE paragon_internal.login_challenges SET consumed_at = NOW()
    WHERE id = $1 AND kind = 'google-link' AND consumed_at IS NULL
      AND expires_at > NOW() RETURNING id`, [id]);
  return Boolean(result.rowCount);
}

// This statement locks the challenge row. Concurrent verification requests can
// never both consume it, and wrong attempts persist even when validation fails.
export async function verifyCode(id: string, hash: string): Promise<LoginChallenge | undefined> {
  const result = await db.query(`UPDATE paragon_internal.login_challenges
    SET attempts = attempts + 1,
        consumed_at = CASE WHEN code_hash = $2 AND code_expires_at > NOW() THEN NOW() ELSE NULL END
    WHERE id = $1 AND kind = 'email' AND consumed_at IS NULL
      AND expires_at > NOW() AND attempts < 5
    RETURNING *, (code_hash = $2 AND code_expires_at > NOW()) AS valid`, [id, hash]);
  return result.rows[0]?.valid === true ? result.rows[0] : undefined;
}

export async function reserveDelivery(userId: string): Promise<boolean> {
  const result = await db.query(`INSERT INTO paragon_internal.auth_email_limits (user_id, sent_at, window_at, sends)
    VALUES ($1, NOW(), NOW(), 1)
    ON CONFLICT (user_id) DO UPDATE SET sent_at = NOW(),
      window_at = CASE WHEN auth_email_limits.window_at < NOW() - INTERVAL '15 minutes'
        THEN NOW() ELSE auth_email_limits.window_at END,
      sends = CASE WHEN auth_email_limits.window_at < NOW() - INTERVAL '15 minutes'
        THEN 1 ELSE auth_email_limits.sends + 1 END
    WHERE auth_email_limits.sent_at < NOW() - INTERVAL '60 seconds'
      AND (auth_email_limits.window_at < NOW() - INTERVAL '15 minutes' OR auth_email_limits.sends < 5)
    RETURNING user_id`, [userId]);
  return Boolean(result.rowCount);
}

// Shared across API instances and fresh browser challenges. Hash keys avoid
// storing raw usernames or IP addresses in the abuse-control table.
export async function reserveAttempt(context: string, maximum: number): Promise<boolean> {
  const key = createHash('sha256').update(`paragon-auth-limit\0${context}`).digest('hex');
  const result = await db.query(`INSERT INTO paragon_internal.auth_attempt_limits (key, window_at, attempts)
    VALUES ($1, NOW(), 1)
    ON CONFLICT (key) DO UPDATE SET
      window_at = CASE WHEN auth_attempt_limits.window_at < NOW() - INTERVAL '15 minutes'
        THEN NOW() ELSE auth_attempt_limits.window_at END,
      attempts = CASE WHEN auth_attempt_limits.window_at < NOW() - INTERVAL '15 minutes'
        THEN 1 ELSE auth_attempt_limits.attempts + 1 END
    WHERE auth_attempt_limits.window_at < NOW() - INTERVAL '15 minutes' OR auth_attempt_limits.attempts < $2
    RETURNING key`, [key, maximum]);
  return Boolean(result.rowCount);
}

export async function reserveCredentialAttempt(username: string, ipAddress: string): Promise<boolean> {
  await db.query(`DELETE FROM paragon_internal.auth_attempt_limits WHERE key IN (
    SELECT key FROM paragon_internal.auth_attempt_limits WHERE window_at < NOW() - INTERVAL '1 day' LIMIT 100)`);
  const reservations = await Promise.all([
    reserveAttempt(`password-account:${username.trim().toLowerCase()}`, 10),
    reserveAttempt(`password-network:${ipAddress}`, 50),
  ]);
  return reservations.every(Boolean);
}

export async function setEmailCode(id: string, hash: string): Promise<number | undefined> {
  const result = await db.query<{ code_expires_at: Date }>(`UPDATE paragon_internal.login_challenges
    SET code_hash = $2, code_expires_at = LEAST(expires_at, NOW() + INTERVAL '5 minutes')
    WHERE id = $1 AND kind = 'email' AND consumed_at IS NULL AND attempts < 5 AND expires_at > NOW()
    RETURNING code_expires_at`, [id, hash]);
  return result.rows[0]?.code_expires_at.getTime();
}
