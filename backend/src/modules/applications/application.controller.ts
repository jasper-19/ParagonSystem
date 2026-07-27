import { Request, Response, NextFunction } from "express";
import * as service from "./application.service";
import * as notificationService from "../notifications/notification.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";
import { emitApplicationsUpdated, emitApplicationSettingsUpdated } from "../../realtime/socket.events";

/** GET /api/applications?page=&limit=&status=&search=&sort=&order= */
export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const query: service.GetApplicationsQuery = {};

    const status = req.query["status"];
    if (typeof status === "string" && status.trim() !== "") {
      query.status = sanitizeValue(status) as string;
    }

    const search = req.query["search"];
    if (typeof search === "string" && search.trim() !== "") {
      query.search = sanitizeValue(search) as string;
    }

    const page = req.query["page"];
    if (typeof page === "string" && page.trim() !== "") {
      query.page = Number(sanitizeValue(page));
    }

    const limit = req.query["limit"];
    if (typeof limit === "string" && limit.trim() !== "") {
      query.limit = Number(sanitizeValue(limit));
    }

    const sort = req.query["sort"];
    if (typeof sort === "string" && sort.trim() !== "") {
      query.sort = sanitizeValue(sort) as string;
    }

    const order = req.query["order"];
    if (order === "asc" || order === "desc") {
      query.order = order;
    }

    const applications = await service.getApplications(query);

    res.json(applications);
  }
);

/** GET /api/applications/:id */
export const getApplicationById = asyncHandler(
  async (req: Request, res: Response) => {
    // Express guarantees req.params.id exists when route /:id matches
    const id = req.params["id"] as string;
    const application = await service.getApplicationById(id);
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    res.json(application);
  }
);

/** POST /api/applications — body already validated by Zod middleware */
export const createApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const application = await service.createApplication(req.body);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    notificationService.createForEvent(
      "application",
      `New application received from ${(application as any).fullName ?? 'an applicant'}.`,
      "application"
    ).catch(() => {});
    auditLog(
      req,
      "CREATE",
      "APPLICATIONS",
      `Created application: ${(application as any).fullName ?? "Applicant"}`,
      {
        resourceId: String((application as any).id ?? ""),
        details: {
          fullName: (application as any).fullName,
          email: (application as any).email,
          status: (application as any).status,
        },
      }
    );
    res.status(201).json(application);
  }
);

/** PATCH /api/applications/:id/status */
export const updateStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { status } = req.body as { status: string };
    const updated = await service.updateApplicationStatus(id, status);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    auditLog(req, "UPDATE_STATUS", "APPLICATIONS", `Updated application status to ${status}: ${id}`, {
      resourceId: id,
      details: { status },
    });
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/interview */
export const scheduleInterview = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { interviewDate } = req.body as { interviewDate: string };
    const updated = await service.scheduleInterview(id, interviewDate);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    auditLog(req, "SCHEDULE_INTERVIEW", "APPLICATIONS", `Scheduled interview for application: ${id}`, {
      resourceId: id,
      details: { interviewDate },
    });
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/interview-complete */
export const markInterviewed = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const updated = await service.markInterviewed(id);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    auditLog(req, "MARK_INTERVIEWED", "APPLICATIONS", `Marked application interviewed: ${id}`, {
      resourceId: id,
    });
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/interview-notes */
export const addInterviewNotes = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { notes } = req.body as { notes: string };
    const updated = await service.addInterviewNotes(id, notes);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    auditLog(req, "ADD_NOTES", "APPLICATIONS", `Added interview notes to application: ${id}`, {
      resourceId: id,
      details: { notes },
    });
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/accept */
export const acceptApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    // interviewNotes is optional — callers may pass final notes at acceptance time
    const { interviewNotes } = req.body as { interviewNotes?: string };
    const updated = await service.acceptApplication(id, interviewNotes);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    notificationService.createForEvent(
      "application",
      `Application accepted: ${(updated as any).fullName ?? id}.`,
      "application"
    ).catch(() => {});
    auditLog(req, "ACCEPT", "APPLICATIONS", `Accepted application: ${(updated as any).fullName ?? id}`, {
      resourceId: id,
      details: { interviewNotes: interviewNotes ?? null },
    });
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/reject */
export const rejectApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const updated = await service.rejectApplication(id);

    emitApplicationsUpdated(); // Notify clients that applications have been updated
    
    notificationService.createForEvent(
      "application",
      `Application rejected: ${(updated as any).fullName ?? id}.`,
      "application"
    ).catch(() => {});
    auditLog(req, "REJECT", "APPLICATIONS", `Rejected application: ${(updated as any).fullName ?? id}`, {
      resourceId: id,
    });
    res.json(updated);
  }
);

/** DELETE /api/applications/:id */
export const deleteApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    await service.deleteApplication(id);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    auditLog(req, "DELETE", "APPLICATIONS", `Deleted application: ${id}`, {
      resourceId: id,
    });
    res.status(204).send();
  }
);

/** PATCH /api/applications/:id/assign */
export const assignApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { section, role } = req.body as { section: string; role: string };
    const updated = await service.assignApplication(id, section, role);

    emitApplicationsUpdated(); // Notify clients that applications have been updated

    auditLog(req, "ASSIGN", "APPLICATIONS", `Assigned application: ${id}`, {
      resourceId: id,
      details: { section, role },
    });
    res.json(updated);
  }
);

/** GET /api/applications/settings — public */
export const getApplicationSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    const settings = await service.getApplicationSettings();

    res.json(settings);
  }
);

/** PATCH /api/applications/settings — admin only */
export const updateApplicationSettings = asyncHandler(
  async (req: Request, res: Response) => {
    const updated = await service.updateApplicationSettings(
      req.body
    );

    emitApplicationSettingsUpdated(); // Notify clients that application settings have been updated

    auditLog(
      req,
      "UPDATE",
      "APPLICATIONS",
      updated.isOpen
        ? "Opened publication applications"
        : "Closed publication applications",
      {
        details: {
          isOpen: updated.isOpen,
          announcement: updated.announcement,
        },
      }
    );

    res.json(updated);
  }
);
