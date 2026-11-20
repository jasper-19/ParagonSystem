import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';
import pool from '../config/db';
import { requireMailConfiguration } from '../modules/auth/email-code.service';
import { startGoogleOAuth } from '../modules/auth/google-oauth.service';
import { assertGoogleEmailSchema } from '../security/google-email-schema';

async function main(): Promise<void> {
  const [username, email, approval] = process.argv.slice(2);
  if (!username || !/^[a-zA-Z0-9._-]{3,100}$/.test(username) ||
      !email || !/^[^\s@]+@gmail\.com$/.test(email) || email !== email.toLowerCase()) {
    throw new Error('Usage: provision-developer <username> <lowercase Gmail> [--production-approved]');
  }
  if (process.env.NODE_ENV === 'production' && approval !== '--production-approved') {
    throw new Error('Explicit production approval is required.');
  }
  requireMailConfiguration();
  startGoogleOAuth(); // Validate Google configuration without making a request.
  await assertGoogleEmailSchema(pool);
  // There is no distributed password. Password authentication is also rejected
  // by the service for every developer account, even after an operator reset.
  const hash = await bcrypt.hash(randomBytes(48).toString('base64url'), 12);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '5s'");
    await client.query('LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE');
    const conflict = await client.query(`SELECT 1 FROM public.users u
      LEFT JOIN public.staff_members sm ON sm.id = u.staff_id
      LEFT JOIN paragon_internal.google_identities gi ON gi.user_id = u.id
      WHERE u.username = $1 OR u.developer_email = $2 OR LOWER(TRIM(sm.email)) = $2 OR gi.email = $2`, [username, email]);
    if (conflict.rowCount) throw new Error('Account or email already exists; refusing to replace or elevate an existing account.');
    const result = await client.query(`INSERT INTO public.users
      (username, password_hash, role, staff_id, two_fa_enabled, is_active, developer_email)
      VALUES ($1, $2, 'admin', NULL, TRUE, TRUE, $3) RETURNING id`, [username, hash, email]);
    await client.query(`INSERT INTO public.activity_logs (user_id, action, resource_type, resource_id, details)
      VALUES ($1, 'CREATE', 'USERS', $1, $2::jsonb)`,
      [result.rows[0].id, JSON.stringify({ provisioning: 'operator-cli', accountType: 'developer', role: 'admin' })]);
    await client.query('COMMIT');
    console.log('Developer account created. Use Google sign-in and complete email verification. No password was issued.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main().catch(() => {
  // Database errors can contain account data or connection credentials.
  console.error('Provisioning failed. Verify arguments, approval, configuration, migration, and account uniqueness. No existing account was modified.');
  process.exitCode = 1;
}).finally(() => pool.end());
