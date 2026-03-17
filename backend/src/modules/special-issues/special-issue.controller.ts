import { Request, Response } from "express";
import * as service from "./special-issue.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";

/** GET /api/issues */
export const getIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const raw = req.query["status"];

    const status =
      typeof raw === "string"
        ? (sanitizeValue(raw) as string)
        : undefined;

    const issues = await service.getIssues(status);

    res.json(issues);
  }
);

/** GET /api/issues/:slug */
export const getIssueBySlug = asyncHandler(
  async (req: Request, res: Response) => {

    const slug = sanitizeValue(req.params["slug"]) as string;

    const issue = await service.getIssueBySlug(slug);

    if (!issue) {
      res.status(404).json({ message: "Issue not found" });
      return;
    }

    res.json(issue);
  }
);

/** GET /api/issues/type/:type */
export const getIssuesByType = asyncHandler(
  async (req: Request, res: Response) => {
    const type = sanitizeValue(req.params["type"]) as string;

    const issues = await service.getIssuesByType(type);

    res.json(issues);
  }
);

/** POST /api/issues - body validated by Zod middleware */
export const createIssue = asyncHandler(
  async (req: Request, res: Response) => {

    const issue = await service.createIssue(req.body);

    res.status(201).json(issue);
  }
);

/** PATCH /api/issues/:id */
export const updateIssue = asyncHandler(
  async (req: Request, res: Response) => {

    const id = sanitizeValue(req.params["id"]) as string;

    const issue = await service.updateIssue(id, req.body);

    res.json(issue);
  }
);

/** PATCH /api/issues/:id/status - body validated by Zod middleware */
export const updateIssueStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const id = sanitizeValue(req.params["id"]) as string;
    const status = (req.body as { status: string }).status;

    const issue = await service.updateIssueStatus(id, status);

    res.json(issue);
  }
);

/** DELETE /api/issues/:id */
export const deleteIssue = asyncHandler(
  async (req: Request, res: Response) => {

    const id = sanitizeValue(req.params["id"]) as string;

    await service.deleteIssue(id);

    res.status(204).send();
  }
);
