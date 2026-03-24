import db from "../../config/db";
import { ActivityLog, ActivityLogFilters, CreateActivityLogInput } from "./activity-log.types";

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function mapRow(row: any): ActivityLog {
  const metadata = asObject(row.details);
  const action = String(row.action ?? "UNKNOWN").toUpperCase();
  const moduleName = String(row.resource_type ?? "SYSTEM").toUpperCase();
  const detailsDescription =
    metadata && typeof metadata["description"] === "string"
      ? metadata["description"]
      : metadata && typeof metadata["message"] === "string"
        ? metadata["message"]
        : undefined;

  return {
    id: String(row.id),
    ...(row.user_id ? { userId: String(row.user_id) } : {}),
    ...(row.user_name ? { userName: String(row.user_name) } : {}),
    action,
    module: moduleName,
    description: detailsDescription ?? `${action} ${moduleName}`,
    ...(row.resource_id ? { entityId: String(row.resource_id) } : {}),
    entityType: moduleName,
    ...(metadata ? { metadata } : {}),
    ...(row.ip_address ? { ipAddress: String(row.ip_address) } : {}),
    ...(row.user_agent ? { userAgent: String(row.user_agent) } : {}),
    createdAt: toIsoString(row.created_at),
  };
}

export async function findAll(filters: ActivityLogFilters = {}): Promise<ActivityLog[]> {
  const where: string[] = [];
  const values: Array<string | number> = [];
  let idx = 1;

  if (filters.module) {
    where.push(`UPPER(COALESCE(al.resource_type, 'SYSTEM')) = UPPER($${idx++})`);
    values.push(filters.module);
  }

  if (filters.action) {
    where.push(`UPPER(al.action) = UPPER($${idx++})`);
    values.push(filters.action);
  }

  if (filters.dateFrom) {
    where.push(`al.created_at >= $${idx++}::timestamptz`);
    values.push(filters.dateFrom);
  }

  if (filters.search) {
    where.push(
      `(COALESCE(u.username, '') ILIKE $${idx} OR al.action ILIKE $${idx} OR COALESCE(al.resource_type, '') ILIKE $${idx} OR COALESCE(al.details::text, '') ILIKE $${idx})`
    );
    values.push(`%${filters.search}%`);
    idx++;
  }

  const limit = filters.limit ?? 200;
  values.push(limit);
  const limitPos = idx;

  const result = await db.query(
    `SELECT
       al.id,
       al.user_id,
       u.username AS user_name,
       al.action,
       al.resource_type,
       al.resource_id,
       al.details,
       al.ip_address::text AS ip_address,
       al.user_agent,
       al.created_at
     FROM activity_logs al
     LEFT JOIN users u ON u.id = al.user_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY al.created_at DESC
     LIMIT $${limitPos}`,
    values
  );

  return result.rows.map(mapRow);
}

export async function create(input: CreateActivityLogInput): Promise<ActivityLog> {
  const result = await db.query(
    `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, user_id, action, resource_type, resource_id, details, ip_address::text AS ip_address, user_agent, created_at`,
    [
      input.userId ?? null,
      input.action,
      input.resourceType ?? null,
      input.resourceId ?? null,
      input.details ?? null,
      input.ipAddress ?? null,
      input.userAgent ?? null,
    ]
  );

  return mapRow(result.rows[0]);
}
