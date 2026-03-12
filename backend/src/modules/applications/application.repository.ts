import db from "../../config/db";

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
    positionId: row.position_id,
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

export async function findAll(status?: string) {

  if (status) {
    const result = await db.query(
      `SELECT * FROM applications
       WHERE status = $1
       ORDER BY created_at DESC`,
      [status]
    );

    return result.rows.map(mapRow);
  }

  const result = await db.query(
    `SELECT * FROM applications
     ORDER BY created_at DESC`
  );

  return result.rows.map(mapRow);
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
        position_id,
        sub_role,
        motivation,
        portfolio_url,
        additional_notes
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
      [
        d.fullName,
        d.email,
        d.studentId,
        d.yearLevel,
        d.collegeId,
        d.programId,
        d.positionId,
        d.subRole ?? null,
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