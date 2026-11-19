import db from '../../config/db';

export interface GoogleIdentity { user_id: string; subject: string; email: string }

export async function findGoogleIdentity(subject: string): Promise<GoogleIdentity | undefined> {
  const result = await db.query(`SELECT user_id, subject, email FROM paragon_internal.google_identities WHERE subject = $1`, [subject]);
  return result.rows[0];
}

export async function getGoogleIdentity(userId: string): Promise<GoogleIdentity | undefined> {
  const result = await db.query(`SELECT user_id, subject, email FROM paragon_internal.google_identities WHERE user_id = $1`, [userId]);
  return result.rows[0];
}

// Recheck the exact account snapshot and staff email in the INSERT itself.
// Neither a second Google identity nor a different PARAGON user can replace a link.
export async function linkGoogleIdentity(input: {
  userId: string; subject: string; email: string; passwordHash: string; authVersion: string;
}): Promise<boolean> {
  const result = await db.query(`INSERT INTO paragon_internal.google_identities (user_id, subject, email)
    SELECT u.id, $2, $3 FROM public.users u JOIN public.staff_members sm ON sm.id = u.staff_id
    WHERE u.id = $1 AND u.is_active = TRUE AND u.password_hash = $4
      AND u.auth_version = $5::bigint AND LOWER(TRIM(sm.email)) = $3
    ON CONFLICT DO NOTHING RETURNING user_id`,
    [input.userId, input.subject, input.email, input.passwordHash, input.authVersion]);
  if (result.rowCount) return true;
  const existing = await getGoogleIdentity(input.userId);
  return existing?.subject === input.subject && existing.email === input.email;
}
