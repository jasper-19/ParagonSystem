import { Request, Response, NextFunction } from "express";
import * as service from "./application.service";
import * as notificationService from "../notifications/notification.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";
import { emitApplicationsUpdated, emitApplicationSettingsUpdated } from "../../realtime/socket.events";

/** GET /api/applications?page=&limit=&status=&search=&sort=&order= */
export const getApplications = asyncHandler(
  async (req: Request, res: Response) => {
    const query = res.locals["validatedQuery"] as service.GetApplicationsQuery;

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


    notificationService.createForEvent(
      "application",
      `New application received from ${(application as any).fullName ?? 'an applicant'}.`,
      "application"
    ).catch(() => {});
    await auditLog(
      req,
      "CREATE",
      "APPLICATIONS",
      "Created application",
      {
        resourceId: String((application as any).id ?? ""),
        details: {
          status: (application as any).status,
        },
      }
    );
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.status(201).json(application);
  }
);

/** PATCH /api/applications/:id/status */
export const updateStatus = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { status } = req.body as { status: string };
    const updated = await service.updateApplicationStatus(id, status);


    await auditLog(req, "UPDATE_STATUS", "APPLICATIONS", `Updated application status to ${status}: ${id}`, {
      resourceId: id,
      details: { status },
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/interview */
export const scheduleInterview = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { interviewDate } = req.body as { interviewDate: string };
    const updated = await service.scheduleInterview(id, interviewDate);


    await auditLog(req, "SCHEDULE_INTERVIEW", "APPLICATIONS", `Scheduled interview for application: ${id}`, {
      resourceId: id,
      details: { interviewDate },
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/interview-complete */
export const markInterviewed = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const updated = await service.markInterviewed(id);


    await auditLog(req, "MARK_INTERVIEWED", "APPLICATIONS", `Marked application interviewed: ${id}`, {
      resourceId: id,
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/interview-notes */
export const addInterviewNotes = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { notes } = req.body as { notes: string };
    const updated = await service.addInterviewNotes(id, notes);


    await auditLog(req, "ADD_NOTES", "APPLICATIONS", `Added interview notes to application: ${id}`, {
      resourceId: id,
      details: { notesChanged: true },
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
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


    notificationService.createForEvent(
      "application",
      `Application accepted: ${(updated as any).fullName ?? id}.`,
      "application"
    ).catch(() => {});
    await auditLog(req, "ACCEPT", "APPLICATIONS", `Accepted application: ${id}`, {
      resourceId: id,
      details: { notesChanged: interviewNotes !== undefined },
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.json(updated);
  }
);

/** PATCH /api/applications/:id/reject */
export const rejectApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const updated = await service.rejectApplication(id);

    
    notificationService.createForEvent(
      "application",
      `Application rejected: ${(updated as any).fullName ?? id}.`,
      "application"
    ).catch(() => {});
    await auditLog(req, "REJECT", "APPLICATIONS", `Rejected application: ${id}`, {
      resourceId: id,
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.json(updated);
  }
);

/** DELETE /api/applications/:id */
export const deleteApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    await service.deleteApplication(id);


    await auditLog(req, "DELETE", "APPLICATIONS", `Deleted application: ${id}`, {
      resourceId: id,
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
    res.status(204).send();
  }
);

/** PATCH /api/applications/:id/assign */
export const assignApplication = asyncHandler(
  async (req: Request, res: Response) => {
    const id = req.params["id"] as string;
    const { section, role } = req.body as { section: string; role: string };
    const updated = await service.assignApplication(id, section, role);


    await auditLog(req, "ASSIGN", "APPLICATIONS", `Assigned application: ${id}`, {
      resourceId: id,
      details: { section, role },
    });
    emitApplicationsUpdated(); // Notify clients that applications have been updated
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


    await auditLog(
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

    emitApplicationSettingsUpdated(); // Notify clients that application settings have been updated
    res.json(updated);
  }
);
