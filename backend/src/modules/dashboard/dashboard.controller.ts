import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./dashboard.service";

export const getDashboardFeed = asyncHandler(
  async (_req: Request, res: Response) => {
    const feed = await service.getDashboardFeed();

    res.json(feed);
  }
);