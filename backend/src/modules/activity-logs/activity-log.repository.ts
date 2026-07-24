import db from "../../config/db";
import { ActivityLog, ActivityLogFilters, CreateActivityLogInput, PaginatedActivityLogs } from "./activity-log.types";

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function cleanIpAddress(value: unknown): string | undefined {
  if (!value) return undefined;
  return String(value).replace(/\/\d+$/, "");
}

function mapRow(row: any): ActivityLog {
  const metadata = asObject(row.details);
  const action = String(row.action ?? "UNKNOWN").toUpperCase();
  const moduleName = String(row.resource_type ?? "SYSTEM").toUpperCase();
  const ipAddress = cleanIpAddress(row.ip_address);
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
    ...(ipAddress ? { ipAddress } : {}),
    ...(row.user_agent ? { userAgent: String(row.user_agent) } : {}),
    createdAt: toIsoString(row.created_at),
  };
}

export async function findAll(
  filters: ActivityLogFilters = {}
): Promise<PaginatedActivityLogs> {
  const whereClauses:
    string[] = [];

  const filterValues:
    Array<string | number> = [];

  let parameterIndex = 1;

  // Module
  if (filters.module) {
    whereClauses.push(
      `UPPER(
         COALESCE(
           al.resource_type,
           'SYSTEM'
         )
       ) = UPPER($${parameterIndex})`
    );

    filterValues.push(
      filters.module
    );

    parameterIndex += 1;
  }

  // Action
  if (filters.action) {
    whereClauses.push(
      `UPPER(al.action) =
       UPPER($${parameterIndex})`
    );

    filterValues.push(
      filters.action
    );

    parameterIndex += 1;
  }

  // Selected calendar day
  if (filters.dateFrom) {
    whereClauses.push(
      `al.created_at >=
         $${parameterIndex}::date
       AND al.created_at <
         (
           $${parameterIndex}::date +
           INTERVAL '1 day'
         )`
    );

    filterValues.push(
      filters.dateFrom
    );

    parameterIndex += 1;
  }

  // Search
  if (filters.search) {
    whereClauses.push(
      `(
        COALESCE(
          u.username,
          ''
        ) ILIKE $${parameterIndex}
        OR al.action
          ILIKE $${parameterIndex}
        OR COALESCE(
          al.resource_type,
          ''
        ) ILIKE $${parameterIndex}
        OR COALESCE(
          al.details::text,
          ''
        ) ILIKE $${parameterIndex}
      )`
    );

    filterValues.push(
      `%${filters.search}%`
    );

    parameterIndex += 1;
  }

  const whereSql =
    whereClauses.length > 0
      ? `WHERE ${whereClauses.join(
          " AND "
        )}`
      : "";

  const requestedPage =
    Math.max(
      1,
      filters.page ?? 1
    );

  const limit =
    Math.min(
      Math.max(
        1,
        filters.limit ?? 25
      ),
      100
    );

  // Count matching rows first
  const countResult =
    await db.query(
      `SELECT
         COUNT(*)::int AS total
       FROM activity_logs al
       LEFT JOIN users u
         ON u.id = al.user_id
       ${whereSql}`,
      filterValues
    );

  const total =
    Number(
      countResult.rows[0]
        ?.total ?? 0
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(total / limit)
    );

  const safePage =
    Math.min(
      requestedPage,
      totalPages
    );

  const offset =
    (safePage - 1) * limit;

  const limitPosition =
    parameterIndex;

  const offsetPosition =
    parameterIndex + 1;

  const pageValues:
    Array<string | number> = [
      ...filterValues,
      limit,
      offset,
    ];

  const result =
    await db.query(
      `SELECT
         al.id,
         al.user_id,
         u.username AS user_name,
         al.action,
         al.resource_type,
         al.resource_id,
         al.details,
         al.ip_address::text
           AS ip_address,
         al.user_agent,
         al.created_at
       FROM activity_logs al
       LEFT JOIN users u
         ON u.id = al.user_id
       ${whereSql}
       ORDER BY
         al.created_at DESC,
         al.id DESC
       LIMIT $${limitPosition}
       OFFSET $${offsetPosition}`,
      pageValues
    );

  return {
    items:
      result.rows.map(
        mapRow
      ),

    page:
      safePage,

    limit,

    total,

    totalPages,
  };
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

export async function getFilterOptions(): Promise<{
  modules: string[];
  actions: string[];
}> {
  const modulesResult = await db.query(
    `SELECT DISTINCT UPPER(COALESCE(resource_type, 'SYSTEM')) AS module
     FROM activity_logs
     ORDER BY module ASC`
  );

  const actionsResult = await db.query(
    `SELECT DISTINCT UPPER(action) AS action
     FROM activity_logs
     ORDER BY action ASC`
  );

  return {
    modules: modulesResult.rows.map((row) => String(row.module)),
    actions: actionsResult.rows.map((row) => String(row.action)),
  };
}