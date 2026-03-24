import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./activity-log.service";
import { ActivityLogFilters, CreateActivityLogInput } from "./activity-log.types";

function parseLimit(raw: unknown): number {
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return 200;
  return Math.min(Math.floor(value), 1000);
}

/** GET /api/activity-logs (admin) */
export const getActivityLogs = asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, unknown>;
  const filters: ActivityLogFilters = {
    ...(typeof q["module"] === "string" && q["module"].trim() ? { module: q["module"].trim() } : {}),
    ...(typeof q["action"] === "string" && q["action"].trim() ? { action: q["action"].trim() } : {}),
    ...(typeof q["dateFrom"] === "string" && q["dateFrom"].trim() ? { dateFrom: q["dateFrom"].trim() } : {}),
    ...(typeof q["search"] === "string" && q["search"].trim() ? { search: q["search"].trim() } : {}),
    limit: parseLimit(q["limit"]),
  };

  const logs = await service.listActivityLogs(filters);
  res.json(logs);
});

/** POST /api/activity-logs (admin) */
export const createActivityLog = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as {
    userId?: string;
    action: string;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  };

  const authUser = (req as any).user as { sub?: string } | undefined;
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined;
  const requestIp = forwardedIp || req.ip;
  const requestUserAgent = req.headers["user-agent"];
  const input: CreateActivityLogInput = {
    action: body.action,
    ...(body.userId ? { userId: body.userId } : {}),
    ...(authUser?.sub && authUser.sub !== "env-admin" && !body.userId ? { userId: authUser.sub } : {}),
    ...(body.resourceType ? { resourceType: body.resourceType } : {}),
    ...(body.resourceId ? { resourceId: body.resourceId } : {}),
    ...(body.details ? { details: body.details } : {}),
    ...(body.ipAddress ? { ipAddress: body.ipAddress } : requestIp ? { ipAddress: requestIp } : {}),
    ...(body.userAgent ? { userAgent: body.userAgent } : typeof requestUserAgent === "string" ? { userAgent: requestUserAgent } : {}),
  };

  const created = await service.createActivityLog(input);
  res.status(201).json(created);
});
