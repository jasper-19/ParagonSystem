// Fail closed when the code is deployed before its security migration.
export async function assertAuthVersionSchema(db: {
  query(sql: string): Promise<{ rows: any[] }>;
}): Promise<void> {
  const result = await db.query(`SELECT
    EXISTS (SELECT 1 FROM pg_attribute a
      WHERE a.attrelid = 'public.users'::regclass AND a.attname = 'auth_version'
        AND a.atttypid = 'bigint'::regtype AND a.attnotnull AND NOT a.attisdropped) AS version_ready,
    EXISTS (SELECT 1 FROM pg_trigger t
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE t.tgrelid = 'public.users'::regclass
        AND t.tgname = 'users_advance_auth_version' AND NOT t.tgisinternal
        AND t.tgenabled IN ('O','A') AND t.tgtype = 19 AND t.tgattr = ''::int2vector
        AND t.tgqual IS NULL AND n.nspname = 'paragon_internal'
        AND p.proname = 'advance_auth_version' AND NOT p.prosecdef
        AND p.proconfig = ARRAY['search_path=pg_catalog']::text[]) AS trigger_ready`);
  if (result.rows[0]?.version_ready !== true || result.rows[0]?.trigger_ready !== true) {
    throw new Error('Authentication version migration is required before startup');
  }
}
