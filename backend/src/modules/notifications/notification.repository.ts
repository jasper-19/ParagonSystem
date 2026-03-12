import db from "../../config/db";

function mapRow(row: any) {
  return {
    id:        String(row.id),
    message:   row.message  as string,
    type:      row.type     as string,
    isRead:    row.is_read  as boolean,
    createdAt: row.created_at as string,
  };
}

export async function findUnread() {
  const result = await db.query(
    `SELECT id, message, type, is_read, created_at
     FROM notifications
     WHERE is_read = FALSE
     ORDER BY created_at DESC
     LIMIT 50`
  );
  return result.rows.map(mapRow);
}

export async function create(message: string, type: string) {
  const result = await db.query(
    `INSERT INTO notifications (message, type)
     VALUES ($1, $2)
     RETURNING id, message, type, is_read, created_at`,
    [message, type]
  );
  return mapRow(result.rows[0]);
}

export async function markAllRead() {
  await db.query(`UPDATE notifications SET is_read = TRUE WHERE is_read = FALSE`);
}
