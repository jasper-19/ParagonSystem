import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./activity-log.service";
import { ActivityLogFilters, CreateActivityLogInput } from "./activity-log.types";

function parsePage(
  raw: unknown
): number {
  const value =
    Number(raw);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 1;
  }

  return Math.floor(value);
}

function parseLimit(
  raw: unknown
): number {
  const value =
    Number(raw);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 25;
  }

  return Math.min(
    Math.floor(value),
    100
  );
}

/** GET /api/activity-logs (admin) */
/** GET /api/activity-logs */
export const getActivityLogs =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const query =
        req.query as Record<
          string,
          unknown
        >;

      const filters:
        ActivityLogFilters = {
        page:
          parsePage(
            query["page"]
          ),

        limit:
          parseLimit(
            query["limit"]
          ),

        ...(
          typeof query["module"] ===
            "string" &&
          query["module"].trim()
            ? {
                module:
                  query["module"]
                    .trim(),
              }
            : {}
        ),

        ...(
          typeof query["action"] ===
            "string" &&
          query["action"].trim()
            ? {
                action:
                  query["action"]
                    .trim(),
              }
            : {}
        ),

        ...(
          typeof query["dateFrom"] ===
            "string" &&
          query["dateFrom"].trim()
            ? {
                dateFrom:
                  query["dateFrom"]
                    .trim(),
              }
            : {}
        ),

        ...(
          typeof query["search"] ===
            "string" &&
          query["search"].trim()
            ? {
                search:
                  query["search"]
                    .trim(),
              }
            : {}
        ),
      };

      const result =
        await service.listActivityLogs(
          filters
        );

      res.json(result);
    }
  );

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

/** GET /api/activity-logs/filter-options (admin) */
export const getActivityLogFilterOptions = asyncHandler(async (_req: Request, res: Response) => {
  const options = await service.getActivityLogFilterOptions();
  res.json(options);
});
