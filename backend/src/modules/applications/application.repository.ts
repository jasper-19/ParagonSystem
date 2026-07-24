import db from "../../config/db";

type ApplicationSettingsRow = {
  id: number;
  is_open: boolean;
  announcement: string;
  updated_at: string;
};

export type ApplicationSettings = {
  isOpen: boolean;
  announcement: string;
  updatedAt: string;
};

export type UpdateApplicationSettingsInput = {
  isOpen?: boolean;
  announcement?: string;
};

function mapSettingsRow(
  row: ApplicationSettingsRow
): ApplicationSettings {
  return {
    isOpen: row.is_open,
    announcement: row.announcement,
    updatedAt: row.updated_at,
  };
}

export type ApplicationListQuery = {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
};

/** Maps a snake_case database row to a camelCase application object. */
function mapRow(row: any) {
  return {
    id: String(row.id),
    fullName: row.full_name,
    email: row.email,
    studentId: row.student_id,
    yearLevel: row.year_level,
    collegeId: row.college_id,
    programId: row.program_id,
    selectedPositions: row.selected_positions ?? [],
    positionId: row.position_id ?? undefined,
    subRole: row.sub_role ?? undefined,
    motivation: row.motivation,
    portfolioUrl: row.portfolio_url ?? undefined,
    additionalNotes: row.additional_notes ?? undefined,
    status: row.status,
    interviewDate: row.interview_date ?? undefined,
    interviewNotes: row.interview_notes ?? undefined,
    interviewed: row.interviewed ?? false,
    assigned: row.assigned ?? false,
    assignedSection: row.assigned_section ?? undefined,
    assignedRole: row.assigned_role ?? undefined,
    createdAt: row.created_at,
  };
}

function mapListRow(row: any) {
  return {
    id: String(row.id),
    fullName: row.full_name,
    email: row.email,
    studentId: row.student_id,
    yearLevel: row.year_level,
    collegeId: row.college_id,
    programId: row.program_id,
    selectedPositions: row.selected_positions ?? [],
    positionId: row.position_id ?? undefined,
    subRole: row.sub_role ?? undefined,
    motivation: row.motivation,
    interviewNotes: row.interview_notes ?? undefined,
    status: row.status,
    interviewed: row.interviewed ?? false,
    assigned: row.assigned ?? false,
    interviewDate: row.interview_date ?? undefined,
    createdAt: row.created_at,
  };
}

export async function findAll(query: ApplicationListQuery = {}) {
  const page = Math.max(Number(query.page ?? 1), 1);
  const limit = Math.min(Math.max(Number(query.limit ?? 10), 1), 50);
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const values: any[] = [];

  if (query.status && query.status !== 'all') {
    values.push(query.status);
    where.push(`status = $${values.length}`);
  }

  if (query.search && query.search.trim() !== '') {
    values.push(`%${query.search.trim()}%`);
    where.push(`(
      full_name ILIKE $${values.length}
      OR email ILIKE $${values.length}
      OR student_id ILIKE $${values.length}
    )`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const sortMap: Record<string, string> = {
    createdAt: 'created_at',
    fullName: 'full_name',
    status: 'status',
    studentId: 'student_id',
  };

  const sortColumn = sortMap[query.sort ?? 'createdAt'] ?? 'created_at';
  const order = query.order === 'asc' ? 'ASC' : 'DESC';

  const [itemsResult, countResult] = await Promise.all([
    db.query(
      `
      SELECT
        id,
        full_name,
        email,
        student_id,
        year_level,
        college_id,
        program_id,
        selected_positions,
        position_id,
        sub_role,
        motivation,
        status,
        interviewed,
        assigned,
        interview_date,
        interview_notes,
        created_at
      FROM applications
      ${whereSql}
      ORDER BY ${sortColumn} ${order}
      LIMIT $${values.length + 1}
      OFFSET $${values.length + 2}
      `,
      [...values, limit, offset]
    ),

    db.query(
      `
      SELECT COUNT(*) AS total
      FROM applications
      ${whereSql}
      `,
      values
    ),
  ]);

  const total = Number(countResult.rows[0]?.total ?? 0);

  return {
    items: itemsResult.rows.map(mapListRow),
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function create(data: unknown) {

  if (!data) {
    throw new Error("Application data is missing");
  }

  const d = data as Record<string, unknown>;

  try {
    const result = await db.query(
      `INSERT INTO applications
      (
        full_name,
        email,
        student_id,
        year_level,
        college_id,
        program_id,
        selected_positions,
        motivation,
        portfolio_url,
        additional_notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        d.fullName,
        d.email,
        d.studentId,
        d.yearLevel,
        d.collegeId,
        d.programId,
        JSON.stringify(d.selectedPositions ?? []),
        d.motivation,
        d.portfolioUrl ?? null,
        d.additionalNotes ?? null
      ]
    );

    return mapRow(result.rows[0]);

  } catch (error) {
    console.error("Error creating application:", error);
    throw error;
  }
}

export async function updateStatus(id: string, status: string) {

  if (!id || !status) {
    throw new Error("Missing id or status");
  }

  try {

    const result = await db.query(
      `UPDATE applications
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    return mapRow(result.rows[0]);

  } catch (error) {
    console.error("Error updating application status:", error);
    throw error;
  }
}

export async function findById(id: string) {
  if (!id) throw new Error('Missing id');

  try {
    const result = await db.query(
      'SELECT * FROM applications WHERE id = $1',
      [id]
    );

    return result.rows[0] ? mapRow(result.rows[0]) : null;
  } catch (error) {
    console.error('Error fetching application by id:', error);
    throw error;
  }
}

export async function scheduleInterview(id: string, interviewDate: string) {
  if (!id || !interviewDate) throw new Error('Missing id or interviewDate');

  try {
    const result = await db.query(
      `UPDATE applications
       SET status = 'interview_scheduled', interview_date = $1
       WHERE id = $2
       RETURNING *`,
      [interviewDate, id]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('Error scheduling interview:', error);
    throw error;
  }
}

export async function markInterviewed(id: string) {
  if (!id) throw new Error('Missing id');

  try {
    const result = await db.query(
      `UPDATE applications
       SET interviewed = true,
           status = 'interview_completed'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('Error marking application as interviewed:', error);
    throw error;
  }
}

export async function acceptApplication(id: string, interviewNotes?: string) {
  if (!id) throw new Error('Missing id');

  try {
    const result = await db.query(
      `UPDATE applications
       SET status          = 'accepted',
           interviewed     = true,
           interview_notes = COALESCE($2, interview_notes)
       WHERE id = $1
       RETURNING *`,
      [id, interviewNotes ?? null]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('Error accepting application:', error);
    throw error;
  }
}

export async function rejectApplication(id: string) {
  if (!id) throw new Error('Missing id');

  try {
    const result = await db.query(
      `UPDATE applications
       SET status = 'rejected'
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('Error rejecting application:', error);
    throw error;
  }
}

/** Permanently delete an application by ID. */
export async function remove(id: string) {
  await db.query(`DELETE FROM applications WHERE id = $1`, [id]);
}

export async function assignApplication(
  id: string,
  section: string,
  role: string
) {
  if (!id || !section || !role) throw new Error('Missing id, section, or role');

  try {
    const result = await db.query(
      `UPDATE applications
       SET assigned = true,
           assigned_section = $1,
           assigned_role = $2
       WHERE id = $3
       RETURNING *`,
      [section, role, id]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('Error assigning application:', error);
    throw error;
  }
}

export async function addInterviewNotes(id: string, notes: string) {
  if (!id || !notes) throw new Error('Missing id or notes');

  try {
    const result = await db.query(
      `UPDATE applications
       SET interview_notes = $1
       WHERE id = $2
       RETURNING *`,
      [notes, id]
    );

    return mapRow(result.rows[0]);
  } catch (error) {
    console.error('Error adding interview notes:', error);
    throw error;
  }
}

export async function getDashboardSummary() {
  const [totals, recent] = await Promise.all([
    db.query(`
      SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'pending') AS pending,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'accepted') AS accepted,
        COUNT(*) FILTER (WHERE LOWER(status::text) = 'rejected') AS rejected
      FROM applications
    `),

    db.query(`
      SELECT *
      FROM applications
      ORDER BY created_at DESC
      LIMIT 5
    `),
  ]);

  return {
    total: Number(totals.rows[0].total),
    pending: Number(totals.rows[0].pending),
    accepted: Number(totals.rows[0].accepted),
    rejected: Number(totals.rows[0].rejected),
    recent: recent.rows.map(mapRow),
  };
}

export async function getCreatedCountsByDate() {
  const result = await db.query(`
    SELECT
      created_at::date AS date,
      COUNT(*) AS count
    FROM applications
    WHERE created_at IS NOT NULL
    GROUP BY created_at::date
    ORDER BY date ASC
  `);

  return result.rows.map(row => ({
    date: row.date,
    count: Number(row.count),
  }));
}

export async function findApplicationSettings(): Promise<ApplicationSettings> {
  const result = await db.query(
    `SELECT
       id,
       is_open,
       announcement,
       updated_at
     FROM application_settings
     WHERE id = 1`
  );

  if (result.rows.length > 0) {
    return mapSettingsRow(
      result.rows[0] as ApplicationSettingsRow
    );
  }

  const created = await db.query(
    `INSERT INTO application_settings (
       id,
       is_open,
       announcement
     )
     VALUES (
       1,
       false,
       'Applications are currently closed. Please wait for the next recruitment period.'
     )
     RETURNING
       id,
       is_open,
       announcement,
       updated_at`
  );

  return mapSettingsRow(
    created.rows[0] as ApplicationSettingsRow
  );
}

export async function updateApplicationSettings(
  input: UpdateApplicationSettingsInput
): Promise<ApplicationSettings> {
  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (typeof input.isOpen === "boolean") {
    values.push(input.isOpen);
    setClauses.push(`is_open = $${values.length}`);
  }

  if (typeof input.announcement === "string") {
    values.push(input.announcement.trim());
    setClauses.push(`announcement = $${values.length}`);
  }

  if (setClauses.length === 0) {
    return findApplicationSettings();
  }

  const result = await db.query(
    `UPDATE application_settings
     SET
       ${setClauses.join(", ")},
       updated_at = NOW()
     WHERE id = 1
     RETURNING
       id,
       is_open,
       announcement,
       updated_at`,
    values
  );

  if (result.rows.length === 0) {
    throw Object.assign(
      new Error("Application settings not found"),
      { statusCode: 404 }
    );
  }

  return mapSettingsRow(
    result.rows[0] as ApplicationSettingsRow
  );
}