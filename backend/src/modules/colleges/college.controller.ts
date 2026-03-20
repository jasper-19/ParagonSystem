import { Request, Response } from "express";
import * as service from "./college.service";
import { asyncHandler } from "../../utils/asyncHandler";

/** GET /api/colleges */
export const getColleges = asyncHandler(async (_req: Request, res: Response) => {
  const colleges = await service.getColleges();
  res.json(colleges);
});

