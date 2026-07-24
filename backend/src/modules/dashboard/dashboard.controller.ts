import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./dashboard.service";
import { DashboardAnalyticsMode } from "./dashboard.types";

function parseMode(value: unknown): DashboardAnalyticsMode {
  if (
    value === "daily" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }

  return "daily";
}

export const getDashboardFeed = asyncHandler(
  async (req: Request, res: Response) => {
    const mode = parseMode(req.query["mode"]);

    const feed = await service.getDashboardFeed(mode);

    res.json(feed);
  }
);