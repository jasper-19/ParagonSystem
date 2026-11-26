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
    'articles','article_slug_history','colleges','editorial_board_members','editorial_boards',
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

-- Operator-provisioned Google-only administrators; never set by a public API.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS developer_email text;
CREATE UNIQUE INDEX IF NOT EXISTS users_developer_email_unique ON public.users(developer_email)
  WHERE developer_email IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.users'::regclass
    AND conname = 'users_developer_account_policy') THEN
    ALTER TABLE public.users ADD CONSTRAINT users_developer_account_policy CHECK (
      developer_email IS NULL OR (developer_email = lower(trim(developer_email))
        AND developer_email ~ '^[^[:space:]@]+@gmail[.]com$'
        AND role = 'admin' AND staff_id IS NULL AND two_fa_enabled IS TRUE));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION paragon_internal.advance_auth_version()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF ROW(NEW.password_hash, NEW.role, NEW.staff_id, NEW.is_active, NEW.username, NEW.two_fa_enabled, NEW.developer_email)
     IS DISTINCT FROM
     ROW(OLD.password_hash, OLD.role, OLD.staff_id, OLD.is_active, OLD.username, OLD.two_fa_enabled, OLD.developer_email) THEN
    NEW.auth_version := OLD.auth_version + 1;
  ELSE
    NEW.auth_version := GREATEST(OLD.auth_version, NEW.auth_version);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION paragon_internal.advance_auth_version() FROM PUBLIC;
DROP TRIGGER IF EXISTS users_advance_auth_version ON public.users;
CREATE TRIGGER users_advance_auth_version BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION paragon_internal.advance_auth_version();

-- Login state is server-only. Browser Supabase roles must never access it.
CREATE TABLE IF NOT EXISTS paragon_internal.google_identities (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  subject text NOT NULL UNIQUE CHECK (length(subject) BETWEEN 1 AND 255),
  email text NOT NULL CHECK (email = lower(email) AND email LIKE '%@gmail.com'),
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS paragon_internal.login_challenges (
  id text PRIMARY KEY CHECK (id ~ '^[a-f0-9]{64}$'),
  kind text NOT NULL CHECK (kind IN ('oauth', 'google-link', 'email')),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  code_hash text,
  code_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz
);
CREATE INDEX IF NOT EXISTS login_challenges_expiry ON paragon_internal.login_challenges(expires_at);
CREATE INDEX IF NOT EXISTS login_challenges_user ON paragon_internal.login_challenges(user_id);
CREATE TABLE IF NOT EXISTS paragon_internal.auth_email_limits (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  sent_at timestamptz NOT NULL,
  window_at timestamptz NOT NULL,
  sends integer NOT NULL CHECK (sends BETWEEN 1 AND 5)
);
CREATE TABLE IF NOT EXISTS paragon_internal.auth_attempt_limits (
  key text PRIMARY KEY CHECK (key ~ '^[a-f0-9]{64}$'),
  window_at timestamptz NOT NULL,
  attempts integer NOT NULL CHECK (attempts BETWEEN 1 AND 50)
);
REVOKE ALL ON ALL TABLES IN SCHEMA paragon_internal FROM PUBLIC;
DO $$
DECLARE browser_role text;
BEGIN
  FOREACH browser_role IN ARRAY ARRAY['anon','authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = browser_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA paragon_internal FROM %I', browser_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA paragon_internal FROM %I', browser_role);
    END IF;
  END LOOP;
END $$;

-- A changed staff email must not leave the previous Google identity/session live.
CREATE OR REPLACE FUNCTION paragon_internal.invalidate_staff_google_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog AS $$
BEGIN
  IF LOWER(TRIM(NEW.email)) IS DISTINCT FROM LOWER(TRIM(OLD.email)) THEN
    DELETE FROM paragon_internal.google_identities WHERE user_id IN
      (SELECT id FROM public.users WHERE staff_id = NEW.id);
    UPDATE public.users SET auth_version = auth_version + 1 WHERE staff_id = NEW.id;
    UPDATE public.user_sessions SET revoked_at = NOW() WHERE user_id IN
      (SELECT id FROM public.users WHERE staff_id = NEW.id) AND revoked_at IS NULL;
    DELETE FROM paragon_internal.login_challenges WHERE user_id IN
      (SELECT id FROM public.users WHERE staff_id = NEW.id);
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION paragon_internal.invalidate_staff_google_identity() FROM PUBLIC;
DROP TRIGGER IF EXISTS staff_invalidate_google_identity ON public.staff_members;
CREATE TRIGGER staff_invalidate_google_identity AFTER UPDATE OF email ON public.staff_members
FOR EACH ROW EXECUTE FUNCTION paragon_internal.invalidate_staff_google_identity();

-- Post-application verification: every browser privilege should be false.
SELECT c.relname, c.relrowsecurity,
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
    THEN has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS anon_access,
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
    THEN has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') END AS authenticated_access
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r';
