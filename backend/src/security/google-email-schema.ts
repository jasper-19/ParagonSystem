// Authentication must not run with only part of the new security migration.
export async function assertGoogleEmailSchema(db: {
  query(sql: string): Promise<{ rows: any[] }>;
}): Promise<void> {
  const result = await db.query(`SELECT
    (SELECT COUNT(*) = 4 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'paragon_internal' AND c.relkind = 'r'
        AND c.relname IN ('google_identities','login_challenges','auth_email_limits','auth_attempt_limits')) AS tables_ready,
    EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'paragon_internal' AND p.proname = 'advance_auth_version'
        AND strpos(pg_get_functiondef(p.oid), 'NEW.two_fa_enabled') > 0
        AND strpos(pg_get_functiondef(p.oid), 'NEW.developer_email') > 0) AS factor_version_ready,
    EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgrelid = 'public.staff_members'::regclass
      AND t.tgname = 'staff_invalidate_google_identity' AND NOT t.tgisinternal
      AND t.tgenabled IN ('O','A')) AS email_trigger_ready`);
  const row = result.rows[0];
  if (row?.tables_ready !== true || row?.factor_version_ready !== true || row?.email_trigger_ready !== true) {
    throw new Error('Google/email authentication security migration is required before startup');
  }
}
