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
END
$$;

-- ============================================================
-- editorial_boards table
-- ============================================================
CREATE TABLE IF NOT EXISTS editorial_boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year VARCHAR(50)  NOT NULL,
  adviser_name  VARCHAR(255) NOT NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT FALSE,
  is_satisfied  BOOLEAN      NOT NULL DEFAULT FALSE,
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
END
$$;

-- ============================================================
-- board_members table
-- ============================================================
CREATE TABLE IF NOT EXISTS editorial_board_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES editorial_boards(id) ON DELETE CASCADE,
  staff_id   UUID NOT NULL REFERENCES staff_members(id)   ON DELETE CASCADE,
  section    VARCHAR(100) NOT NULL,
  role       VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Ensure the staff_id FK has ON DELETE CASCADE (fix for tables created before this was added)
DO $$
BEGIN
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
