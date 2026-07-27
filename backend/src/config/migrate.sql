-- Run this once against your paragonDb database to add all columns
-- that were introduced after the initial table creation.
--
-- Each statement uses IF NOT EXISTS / DO blocks so it is safe to
-- re-run without errors if a column already exists.

-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  -- Interview scheduling
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interview_date'
  ) THEN
    ALTER TABLE applications ADD COLUMN interview_date TIMESTAMPTZ;
  END IF;

  -- Interview completion flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interviewed'
  ) THEN
    ALTER TABLE applications ADD COLUMN interviewed BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Interviewer notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'interview_notes'
  ) THEN
    ALTER TABLE applications ADD COLUMN interview_notes TEXT;
  END IF;

  -- Assignment flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'assigned'
  ) THEN
    ALTER TABLE applications ADD COLUMN assigned BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Assigned section
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'assigned_section'
  ) THEN
    ALTER TABLE applications ADD COLUMN assigned_section VARCHAR(100);
  END IF;

  -- Assigned role
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'assigned_role'
  ) THEN
    ALTER TABLE applications ADD COLUMN assigned_role VARCHAR(100);
  END IF;

  -- Year level of the applicant
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'applications' AND column_name = 'year_level'
  ) THEN
    ALTER TABLE applications
      ADD COLUMN year_level VARCHAR(50) NOT NULL DEFAULT 'unspecified'
        CHECK (year_level IN (
          '1st_year',
          '2nd_year',
          '3rd_year',
          '4th_year',
          'unspecified'
        ));
  END IF;
END
$$;

-- ============================================================
-- staff_members table
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id   UUID REFERENCES applications(id) ON DELETE SET NULL,
  full_name        VARCHAR(255) NOT NULL,
  email            VARCHAR(255) NOT NULL,
  student_id       VARCHAR(50),
  year_level       VARCHAR(50),
  college_id       VARCHAR(50),
  program_id       VARCHAR(50),
  position_id      VARCHAR(50),
  sub_role         VARCHAR(100),
  assigned_section VARCHAR(100),
  assigned_role    VARCHAR(100),
  is_board_eligible BOOLEAN NOT NULL DEFAULT TRUE,
  graduated_at     TIMESTAMPTZ,
  last_year_level_transition_academic_year VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add assigned_section / assigned_role if the table already existed without them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'assigned_section'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN assigned_section VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'assigned_role'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN assigned_role VARCHAR(100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'year_level'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN year_level VARCHAR(50);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'is_board_eligible'
  ) THEN
    ALTER TABLE staff_members
      ADD COLUMN is_board_eligible BOOLEAN NOT NULL DEFAULT TRUE;

    -- Preserve the previous eligibility behavior for existing fourth-year
    -- records. Current-board members remain visible through their membership
    -- and can retain an existing assignment; future promotions start eligible.
    UPDATE staff_members sm
    SET is_board_eligible = FALSE
    WHERE sm.year_level = '4th_year';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members' AND column_name = 'graduated_at'
  ) THEN
    ALTER TABLE staff_members ADD COLUMN graduated_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_members'
      AND column_name = 'last_year_level_transition_academic_year'
  ) THEN
    ALTER TABLE staff_members
      ADD COLUMN last_year_level_transition_academic_year VARCHAR(50);
  END IF;
END
$$;

-- ============================================================
-- editorial_boards table
-- ============================================================
CREATE TABLE IF NOT EXISTS editorial_boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year VARCHAR(50)  NOT NULL,
  adviser_name  VARCHAR(255) NOT NULL,
  co_adviser_name VARCHAR(255),
  is_active     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_satisfied  BOOLEAN      NOT NULL DEFAULT FALSE,
  staff_transition_applied_at TIMESTAMPTZ,
  transition_from_board_id UUID REFERENCES editorial_boards(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add is_active column if the table already existed without it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_boards' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE editorial_boards ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT FALSE;
    -- Mark the most recently created board as active so existing data stays valid
    UPDATE editorial_boards
    SET is_active = TRUE
    WHERE id = (
      SELECT id FROM editorial_boards ORDER BY created_at DESC LIMIT 1
    );
  END IF;

  -- Add is_satisfied column if the table already existed without it
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_boards' AND column_name = 'is_satisfied'
  ) THEN
    ALTER TABLE editorial_boards ADD COLUMN is_satisfied BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Optional co-adviser for new and existing editorial boards
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_boards' AND column_name = 'co_adviser_name'
  ) THEN
    ALTER TABLE editorial_boards ADD COLUMN co_adviser_name VARCHAR(255);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_boards'
      AND column_name = 'staff_transition_applied_at'
  ) THEN
    ALTER TABLE editorial_boards
      ADD COLUMN staff_transition_applied_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_boards'
      AND column_name = 'transition_from_board_id'
  ) THEN
    ALTER TABLE editorial_boards
      ADD COLUMN transition_from_board_id UUID
      REFERENCES editorial_boards(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_staff_members_board_eligible
  ON staff_members (created_at DESC)
  WHERE is_board_eligible = TRUE;

-- ============================================================
-- board_members table
-- ============================================================
CREATE TABLE IF NOT EXISTS editorial_board_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES editorial_boards(id) ON DELETE CASCADE,
  staff_id   UUID NOT NULL REFERENCES staff_members(id)   ON DELETE CASCADE,
  section    VARCHAR(100) NOT NULL,
  role       VARCHAR(100) NOT NULL,
  year_level_at_assignment VARCHAR(50),
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ensure the staff_id FK has ON DELETE CASCADE (fix for tables created before this was added)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'editorial_board_members'
      AND column_name = 'year_level_at_assignment'
  ) THEN
    ALTER TABLE editorial_board_members
      ADD COLUMN year_level_at_assignment VARCHAR(50);

    -- Preserve the year level held by existing members before future
    -- editorial-board transitions begin updating their staff profile.
    UPDATE editorial_board_members ebm
    SET year_level_at_assignment = sm.year_level
    FROM staff_members sm
    WHERE sm.id = ebm.staff_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'editorial_board_members_staff_id_fkey'
      AND constraint_type = 'FOREIGN KEY'
  ) THEN
    -- Check if it already has ON DELETE CASCADE
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.referential_constraints
      WHERE constraint_name = 'editorial_board_members_staff_id_fkey'
        AND delete_rule = 'CASCADE'
    ) THEN
      ALTER TABLE editorial_board_members
        DROP CONSTRAINT editorial_board_members_staff_id_fkey;
      ALTER TABLE editorial_board_members
        ADD CONSTRAINT editorial_board_members_staff_id_fkey
        FOREIGN KEY (staff_id) REFERENCES staff_members(id) ON DELETE CASCADE;
    END IF;
  END IF;
END
$$;

-- ============================================================
-- notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message    TEXT         NOT NULL,
  type       VARCHAR(50)  NOT NULL DEFAULT 'info',
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- users table (authentication accounts)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'admin'
    CHECK (role IN ('admin', 'staff')),
  staff_id      UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  two_fa_enabled BOOLEAN     NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Add missing columns if the table already existed without them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE users ADD COLUMN staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'two_fa_enabled'
  ) THEN
    ALTER TABLE users ADD COLUMN two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE users ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
  END IF;
END
$$;

-- A staff member can hold at most one authentication account.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_unique_staff_id
  ON users(staff_id)
  WHERE staff_id IS NOT NULL;

-- ============================================================
-- system_settings singleton (versioned global configuration)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  id                SMALLINT PRIMARY KEY CHECK (id = 1),
  general           JSONB NOT NULL,
  publishing_media  JSONB NOT NULL,
  notifications     JSONB NOT NULL,
  maintenance       JSONB NOT NULL,
  version           BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by        UUID REFERENCES users(id) ON DELETE SET NULL,
  CHECK (jsonb_typeof(general) = 'object'),
  CHECK (jsonb_typeof(publishing_media) = 'object'),
  CHECK (jsonb_typeof(notifications) = 'object'),
  CHECK (jsonb_typeof(maintenance) = 'object')
);

INSERT INTO system_settings (
  id,
  general,
  publishing_media,
  notifications,
  maintenance
)
VALUES (
  1,
  '{"siteName":"The Paragon","organizationName":"Cagayan State University - Gonzaga","contactEmail":"","logoUrl":"","timezone":"Asia/Manila","dateFormat":"YYYY-MM-DD","timeFormat":"12h"}'::jsonb,
  '{"allowDirectPublishing":true,"requireFeaturedImage":true,"maxUploadSizeMb":25,"allowedMimeTypes":["image/jpeg","image/png","image/webp","image/gif","application/pdf","video/mp4","video/webm","audio/mpeg","audio/ogg","audio/wav"],"optimizeImages":true}'::jsonb,
  '{"inAppEnabled":true,"applicationEvents":true,"articleCreated":true,"articlePublished":true}'::jsonb,
  '{"enabled":false,"message":"The publication site is temporarily unavailable while scheduled maintenance is completed.","allowAdminBypass":true}'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- user sessions table (JWT session tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent     TEXT,
  ip_address     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id_active ON user_sessions(user_id) WHERE revoked_at IS NULL;

-- ============================================================
-- colleges / programs reference tables
-- ============================================================
CREATE TABLE IF NOT EXISTS colleges (
  id         VARCHAR(50) PRIMARY KEY,
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS programs (
  id         VARCHAR(50) PRIMARY KEY,
  college_id VARCHAR(50)  NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  name       VARCHAR(255) NOT NULL,
  is_active  BOOLEAN      NOT NULL DEFAULT TRUE,
  sort_order INT          NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_programs_college_id ON programs(college_id);

-- Seed minimal colleges/programs (safe to re-run)
INSERT INTO colleges (id, name, sort_order) VALUES
  ('ca',   'College of Agriculture', 10),
  ('cbea', 'College of Business and Entrepreneurship and Accountancy', 20),
  ('ccje', 'College of Criminal Justice Education', 30),
  ('chm',  'College of Hospitality Management', 40),
  ('cics', 'College of Information and Computing Sciences', 50),
  ('cte',  'College of Teacher Education', 60)
ON CONFLICT (id) DO NOTHING;

INSERT INTO programs (id, college_id, name, sort_order) VALUES
  ('agri',   'ca',   'Bachelor of Science in Agriculture', 10),
  ('acis',   'cbea', 'Bachelor of Science in Accountancy and Information Systems', 10),
  ('crim',   'ccje', 'Bachelor of Science in Criminology', 10),
  ('hosp',   'chm',  'Bachelor of Science in Hospitality Management', 10),
  ('it',     'cics', 'Bachelor of Science in Information Technology', 10),
  ('elem',   'cte',  'Bachelor of Elementary Education', 10),
  ('se-eng', 'cte',  'Bachelor of Secondary Education Major in English', 20),
  ('se-fil', 'cte',  'Bachelor of Secondary Education Major in Filipino', 30)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- activity_logs table (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   UUID,
  details       JSONB,
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

-- ============================================================
-- media_files table (media library)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'media_type'
  ) THEN
    CREATE TYPE media_type AS ENUM ('image', 'video', 'document', 'audio');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS media_files (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name    TEXT NOT NULL,
  disk_name    TEXT NOT NULL UNIQUE,
  storage_path TEXT NOT NULL,
  file_type    media_type NOT NULL,
  mime_type    TEXT NOT NULL,
  size         BIGINT NOT NULL DEFAULT 0,
  width        INTEGER,
  height       INTEGER,
  alt_text     TEXT,
  caption      TEXT,
  tags         TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_media_files_created_at ON media_files(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_files_file_type ON media_files(file_type);

-- ============================================================
-- special_issues table and external PDF storage metadata
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'special_issue_type'
  ) THEN
    CREATE TYPE special_issue_type AS ENUM (
      'Tabloid',
      'Newsletter',
      'Literary Folio'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'special_issue_status'
  ) THEN
    CREATE TYPE special_issue_status AS ENUM (
      'draft',
      'published',
      'archived'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS special_issues (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           VARCHAR(255) NOT NULL,
  slug            VARCHAR(255) NOT NULL UNIQUE,
  type            special_issue_type NOT NULL,
  academic_year   VARCHAR(20) NOT NULL,
  description     TEXT,
  cover_image     TEXT NOT NULL,
  pdf_url         TEXT NOT NULL,
  status          special_issue_status NOT NULL DEFAULT 'draft',
  published_at    TIMESTAMP,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE special_issues
  ADD COLUMN IF NOT EXISTS pdf_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS pdf_original_filename TEXT,
  ADD COLUMN IF NOT EXISTS pdf_mime_type TEXT,
  ADD COLUMN IF NOT EXISTS pdf_original_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS pdf_optimized_size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS pdf_compression_percent NUMERIC(5, 2),
  ADD COLUMN IF NOT EXISTS pdf_page_count INTEGER,
  ADD COLUMN IF NOT EXISTS pdf_sha256 CHAR(64),
  ADD COLUMN IF NOT EXISTS pdf_compression_profile TEXT,
  ADD COLUMN IF NOT EXISTS pdf_processor TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_issues_pdf_sizes_nonnegative'
      AND conrelid = 'special_issues'::regclass
  ) THEN
    ALTER TABLE special_issues
      ADD CONSTRAINT special_issues_pdf_sizes_nonnegative
      CHECK (
        (pdf_original_size_bytes IS NULL OR pdf_original_size_bytes > 0)
        AND
        (pdf_optimized_size_bytes IS NULL OR pdf_optimized_size_bytes > 0)
        AND
        (
          pdf_original_size_bytes IS NULL
          OR pdf_optimized_size_bytes IS NULL
          OR pdf_optimized_size_bytes <= pdf_original_size_bytes
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_issues_pdf_compression_percent_valid'
      AND conrelid = 'special_issues'::regclass
  ) THEN
    ALTER TABLE special_issues
      ADD CONSTRAINT special_issues_pdf_compression_percent_valid
      CHECK (
        pdf_compression_percent IS NULL
        OR pdf_compression_percent BETWEEN 0 AND 100
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_issues_pdf_page_count_positive'
      AND conrelid = 'special_issues'::regclass
  ) THEN
    ALTER TABLE special_issues
      ADD CONSTRAINT special_issues_pdf_page_count_positive
      CHECK (pdf_page_count IS NULL OR pdf_page_count > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_issues_pdf_mime_type_valid'
      AND conrelid = 'special_issues'::regclass
  ) THEN
    ALTER TABLE special_issues
      ADD CONSTRAINT special_issues_pdf_mime_type_valid
      CHECK (
        pdf_mime_type IS NULL
        OR pdf_mime_type = 'application/pdf'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_issues_pdf_sha256_valid'
      AND conrelid = 'special_issues'::regclass
  ) THEN
    ALTER TABLE special_issues
      ADD CONSTRAINT special_issues_pdf_sha256_valid
      CHECK (
        pdf_sha256 IS NULL
        OR pdf_sha256 ~ '^[a-f0-9]{64}$'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'special_issues_pdf_metadata_complete'
      AND conrelid = 'special_issues'::regclass
  ) THEN
    ALTER TABLE special_issues
      ADD CONSTRAINT special_issues_pdf_metadata_complete
      CHECK (
        (
          pdf_storage_path IS NULL
          AND pdf_original_filename IS NULL
          AND pdf_mime_type IS NULL
          AND pdf_original_size_bytes IS NULL
          AND pdf_optimized_size_bytes IS NULL
          AND pdf_compression_percent IS NULL
          AND pdf_page_count IS NULL
          AND pdf_sha256 IS NULL
          AND pdf_compression_profile IS NULL
          AND pdf_processor IS NULL
        )
        OR
        (
          pdf_storage_path IS NOT NULL
          AND pdf_original_filename IS NOT NULL
          AND pdf_mime_type IS NOT NULL
          AND pdf_original_size_bytes IS NOT NULL
          AND pdf_optimized_size_bytes IS NOT NULL
          AND pdf_compression_percent IS NOT NULL
          AND pdf_page_count IS NOT NULL
          AND pdf_sha256 IS NOT NULL
          AND pdf_compression_profile IS NOT NULL
          AND pdf_processor IS NOT NULL
        )
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_special_issues_academic_year
  ON special_issues(academic_year);
CREATE INDEX IF NOT EXISTS idx_special_issues_published_at
  ON special_issues(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_special_issues_status
  ON special_issues(status);
CREATE INDEX IF NOT EXISTS idx_special_issues_type
  ON special_issues(type);

-- Special Issues are served through the authenticated Express API. Keep the
-- underlying public-schema table inaccessible through Supabase's Data API.
ALTER TABLE special_issues ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE special_issues FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE special_issues FROM authenticated;
  END IF;
END
$$;

-- Failed object deletions are kept outside the exposed public schema so they
-- can be retried without exposing internal storage paths through the Data API.
CREATE SCHEMA IF NOT EXISTS paragon_internal;
REVOKE ALL ON SCHEMA paragon_internal FROM PUBLIC;

CREATE TABLE IF NOT EXISTS paragon_internal.storage_cleanup_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path TEXT NOT NULL,
  reason       TEXT NOT NULL,
  attempts     INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_cleanup_jobs_pending_path
  ON paragon_internal.storage_cleanup_jobs(storage_path)
  WHERE completed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_storage_cleanup_jobs_pending_created
  ON paragon_internal.storage_cleanup_jobs(created_at)
  WHERE completed_at IS NULL;
