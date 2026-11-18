-- Requires explicit approval before production execution.
-- The application uses its Express API and server-side PostgreSQL credentials;
-- it does not require Supabase anon/authenticated table access.
-- Run as the owning database role in staging first, inside a transaction.
-- The existing migration runner includes this after migrate.sql, before COMMIT.

DO $$
DECLARE
  relation_name text;
  browser_role text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'activity_logs','application_settings','applications','article_credits',
    'articles','colleges','editorial_board_members','editorial_boards',
    'media_files','notifications','programs','special_issues','staff_members',
    'system_settings','user_sessions','users'
  ] LOOP
    IF to_regclass(format('public.%I', relation_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', relation_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', relation_name);
      FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', relation_name, browser_role);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- An account's security history must not be reset by restoring earlier values.
-- Use a bigint rendered as text in tokens to avoid JavaScript integer rounding.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 0
  CHECK (auth_version >= 0);

CREATE SCHEMA IF NOT EXISTS paragon_internal;
REVOKE ALL ON SCHEMA paragon_internal FROM PUBLIC;

CREATE OR REPLACE FUNCTION paragon_internal.advance_auth_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.password_hash, NEW.role, NEW.staff_id, NEW.is_active, NEW.username)
     IS DISTINCT FROM
     ROW(OLD.password_hash, OLD.role, OLD.staff_id, OLD.is_active, OLD.username) THEN
    NEW.auth_version := OLD.auth_version + 1;
  ELSE
    NEW.auth_version := OLD.auth_version;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION paragon_internal.advance_auth_version() FROM PUBLIC;
DROP TRIGGER IF EXISTS users_advance_auth_version ON public.users;
CREATE TRIGGER users_advance_auth_version BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION paragon_internal.advance_auth_version();

-- Post-application verification: every browser privilege should be false.
SELECT c.relname, c.relrowsecurity,
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    THEN has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS anon_access,
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    THEN has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS authenticated_access
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
