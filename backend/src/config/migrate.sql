-- Run this once against your paragonDb database to add all columns
-- that were introduced after the initial table creation.
--
-- Each statement uses IF NOT EXISTS / DO blocks so it is safe to
-- re-run without errors if a column already exists.

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
