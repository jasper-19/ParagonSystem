import db from '../../config/db';

export async function developerEmail(userId: string): Promise<string | undefined> {
  const result = await db.query('SELECT developer_email FROM public.users WHERE id = $1', [userId]);
  return result.rows[0]?.developer_email || undefined;
}

// Called only after signature, audience, issuer, nonce and verified Gmail checks.
// Exact operator-enrolled email is required; a missing staff record grants nothing.
export async function enrollDeveloperIdentity(identity: { subject: string; email: string }): Promise<void> {
  await db.query(`INSERT INTO paragon_internal.google_identities (user_id, subject, email)
    SELECT id, $1, $2 FROM public.users
    WHERE developer_email = $2 AND is_active = TRUE AND role = 'admin'
      AND staff_id IS NULL AND two_fa_enabled IS TRUE
    ON CONFLICT DO NOTHING`, [identity.subject, identity.email]);
}
