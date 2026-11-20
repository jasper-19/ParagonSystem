import db from "../../config/db";
import { applicationListQuerySchema } from "./application.schema";

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

export async function findAll(input: ApplicationListQuery = {}) {
  const parsed = applicationListQuerySchema.safeParse(input);
  if (!parsed.success) throw Object.assign(new Error("Invalid application query"), { statusCode: 400 });
  const query = parsed.data;
  const { page, limit } = parsed.data;
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

type Status = "pending" | "interview_scheduled" | "interview_completed" | "accepted" | "rejected";

/** Keep status and dependent fields consistent, with a row lock for competing actions. */
async function transition(id: string, status: Status, interviewDate?: string, notes?: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query("SELECT * FROM applications WHERE id = $1 FOR UPDATE", [id]);
    const current = result.rows[0];
    if (!current) throw Object.assign(new Error("Application not found"), { statusCode: 404 });
    if (current.assigned && status !== "accepted") {
      throw Object.assign(new Error("Remove the staff assignment before changing acceptance"), { statusCode: 409 });
    }
    const date = status === "pending" ? null : interviewDate ?? current.interview_date;
    if (status === "interview_scheduled" && !date) {
      throw Object.assign(new Error("Schedule an interview date first"), { statusCode: 409 });
    }
    const interviewed = status === "accepted" || status === "interview_completed" ? true :
      status === "rejected" ? Boolean(current.interviewed) : false;
    const updated = await client.query(
      `UPDATE applications SET status = $2, interviewed = $3, interview_date = $4,
        interview_notes = COALESCE($5, interview_notes),
        assigned = CASE WHEN $6::boolean THEN assigned ELSE false END,
        assigned_section = CASE WHEN $6::boolean THEN assigned_section ELSE NULL END,
        assigned_role = CASE WHEN $6::boolean THEN assigned_role ELSE NULL END
       WHERE id = $1 RETURNING *`,
      [id, status, interviewed, date, notes ?? null, status === 'accepted']
    );
    await client.query("COMMIT");
    return mapRow(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function updateStatus(id: string, status: string) {
  return transition(id, status as Status);
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
  return transition(id, "interview_scheduled", interviewDate);
}

export async function markInterviewed(id: string) {
  return transition(id, "interview_completed");
}

export async function acceptApplication(id: string, interviewNotes?: string) {
  return transition(id, "accepted", undefined, interviewNotes);
}

export async function rejectApplication(id: string) {
  return transition(id, "rejected");
}

export async function remove(id: string) {
  const result = await db.query("DELETE FROM applications WHERE id = $1 RETURNING id", [id]);
  if (!result.rows.length) throw Object.assign(new Error("Application not found"), { statusCode: 404 });
}

export async function assignApplication(id: string, section: string, role: string) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const current = await client.query("SELECT status FROM applications WHERE id = $1 FOR UPDATE", [id]);
    if (!current.rows[0]) throw Object.assign(new Error("Application not found"), { statusCode: 404 });
    if (current.rows[0].status !== "accepted") {
      throw Object.assign(new Error("Only accepted applications can be assigned"), { statusCode: 409 });
    }
    const updated = await client.query(
      `UPDATE applications SET assigned = true, assigned_section = $2, assigned_role = $3
       WHERE id = $1 RETURNING *`, [id, section, role]);
    await client.query("COMMIT");
    return mapRow(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}

export async function addInterviewNotes(id: string, notes: string) {
  const result = await db.query(
    "UPDATE applications SET interview_notes = $2 WHERE id = $1 RETURNING *", [id, notes]);
  if (!result.rows[0]) throw Object.assign(new Error("Application not found"), { statusCode: 404 });
  return mapRow(result.rows[0]);
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

export async function getCreatedCountsByDate(start: Date, end: Date) {
  const result = await db.query(`
    SELECT
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*) AS count
    FROM applications
    WHERE created_at >= $1 AND created_at < $2
    GROUP BY 1
    ORDER BY date ASC
  `, [start.toISOString(), end.toISOString()]);

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
