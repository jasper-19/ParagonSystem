import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./activity-log.service";
import { ActivityLogFilters } from "./activity-log.types";

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
        res.locals["validatedQuery"] as Record<
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

/** GET /api/activity-logs/filter-options (admin) */
export const getActivityLogFilterOptions = asyncHandler(async (_req: Request, res: Response) => {
  const options = await service.getActivityLogFilterOptions();
  res.json(options);
});
