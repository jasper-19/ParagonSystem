import { Request, Response } from "express";
import * as service from "./special-issue.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";
import type { PdfUploadRequest } from "./special-issue-upload.middleware";
import type {
  SpecialIssueListQuery,
} from "./special-issue.schema";

function validatedListQuery(res: Response): SpecialIssueListQuery {
  return res.locals["validatedQuery"] as SpecialIssueListQuery;
}

function sendIssueList(
  res: Response,
  result: {
    items: unknown[];
    page: number;
    pageSize: number;
    hasMore: boolean;
  }
): void {
  res.set({
    "X-Page": String(result.page),
    "X-Page-Size": String(result.pageSize),
    "X-Has-More": String(result.hasMore),
  });
  res.json(result.items);
}

/** GET /api/issues */
export const getIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const issues = await service.getPublishedIssues(validatedListQuery(res));
    sendIssueList(res, issues);
  }
);

export const getAdminIssues = asyncHandler(
  async (req: Request, res: Response) => {
    const issues = await service.getAdminIssues(validatedListQuery(res));
    sendIssueList(res, issues);
  }
);

/** GET /api/issues/:slug */
export const getIssueBySlug = asyncHandler(
  async (req: Request, res: Response) => {

    const slug = sanitizeValue(req.params["slug"]) as string;

    const issue = await service.getPublishedIssueBySlug(slug);

    if (!issue) {
      res.status(404).json({ message: "Issue not found" });
      return;
    }

    res.json(issue);
  }
);

export const getAdminIssueBySlug = asyncHandler(
  async (req: Request, res: Response) => {
    const slug = sanitizeValue(req.params["slug"]) as string;
    const issue = await service.getAdminIssueBySlug(slug);
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

    const issues = await service.getIssuesByType(
      type,
      validatedListQuery(res)
    );
    sendIssueList(res, issues);
  }
);

/** POST /api/issues - body validated by Zod middleware */
export const createIssue = asyncHandler(
  async (req: Request, res: Response) => {
    const uploadRequest = req as PdfUploadRequest;
    const abortController = new AbortController();
    const abort = (): void => abortController.abort();
    req.once("aborted", abort);

    let issue;
    try {
      issue = await service.createIssue(
        req.body,
        uploadRequest.file,
        abortController.signal
      );
    } finally {
      req.removeListener("aborted", abort);
    }
    const issueTitle =
      typeof issue.title === "string" ? issue.title : "Untitled";
    auditLog(req, "CREATE", "SPECIAL_ISSUES", `Created special issue: ${issueTitle}`, {
      resourceId: issue.id,
      details: { title: issue.title, slug: issue.slug, type: issue.type },
    });

    res.status(201).json(issue);
  }
);

/** PATCH /api/issues/:id */
export const updateIssue = asyncHandler(
  async (req: Request, res: Response) => {

    const id = sanitizeValue(req.params["id"]) as string;

    const issue = await service.updateIssue(id, req.body);
    auditLog(req, "UPDATE", "SPECIAL_ISSUES", `Updated special issue: ${issue.title ?? id}`, {
      resourceId: id,
      details: { fields: Object.keys(req.body as Record<string, unknown>) },
    });

    res.json(issue);
  }
);

export const replaceIssuePdf = asyncHandler(
  async (req: Request, res: Response) => {
    const id = sanitizeValue(req.params["id"]) as string;
    const uploadRequest = req as PdfUploadRequest;
    const abortController = new AbortController();
    const abort = (): void => abortController.abort();
    req.once("aborted", abort);

    let issue;
    try {
      issue = await service.replaceIssuePdf(
        id,
        uploadRequest.file,
        abortController.signal
      );
    } finally {
      req.removeListener("aborted", abort);
    }

    auditLog(
      req,
      "REPLACE_PDF",
      "SPECIAL_ISSUES",
      `Replaced Special Issue PDF: ${id}`,
      { resourceId: id }
    );
    res.json(issue);
  }
);

/** PATCH /api/issues/:id/status - body validated by Zod middleware */
export const updateIssueStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const id = sanitizeValue(req.params["id"]) as string;
    const status = (req.body as { status: string }).status;

    const issue = await service.updateIssueStatus(id, status);
    auditLog(req, "UPDATE_STATUS", "SPECIAL_ISSUES", `Updated special issue status to ${status}: ${id}`, {
      resourceId: id,
      details: { status },
    });

    res.json(issue);
  }
);

/** DELETE /api/issues/:id */
export const deleteIssue = asyncHandler(
  async (req: Request, res: Response) => {

    const id = sanitizeValue(req.params["id"]) as string;

    await service.deleteIssue(id);
    auditLog(req, "DELETE", "SPECIAL_ISSUES", `Deleted special issue: ${id}`, {
      resourceId: id,
    });

    res.status(204).send();
  }
);
