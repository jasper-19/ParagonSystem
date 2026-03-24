import { Request } from "express";
import * as activityLogService from "./activity-log.service";

function getActorUserId(req: Request): string | undefined {
  const authUser = (req as any).user as { sub?: string } | undefined;
  return authUser?.sub && authUser.sub !== "env-admin" ? authUser.sub : undefined;
}

function getRequestIp(req: Request): string | undefined {
  const forwarded = req.headers["x-forwarded-for"];
  const forwardedIp = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : undefined;
  return forwardedIp || req.ip || undefined;
}

export function auditLog(
  req: Request,
  action: string,
  resourceType: string,
  description: string,
  options: {
    resourceId?: string;
    details?: Record<string, unknown>;
    userId?: string;
  } = {}
): void {
  const actorUserId = options.userId ?? getActorUserId(req);
  const requestIp = getRequestIp(req);
  const requestUserAgent = req.get("user-agent");

  activityLogService
    .createActivityLog({
      ...(actorUserId ? { userId: actorUserId } : {}),
      action,
      resourceType,
      ...(options.resourceId ? { resourceId: options.resourceId } : {}),
      details: { description, ...(options.details ?? {}) },
      ...(requestIp ? { ipAddress: requestIp } : {}),
      ...(requestUserAgent ? { userAgent: requestUserAgent } : {}),
    })
    .catch(() => undefined);
}
