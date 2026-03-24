import { Request, Response } from "express";
import * as service from "./staff.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";

/** GET /api/staff */
export const getStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await service.getStaffMembers();
  res.json(staff);
});

/** GET /api/staff/eligible-for-board — excludes 4th-year staff */
export const getEligibleStaff = asyncHandler(async (req: Request, res: Response) => {
  const staff = await service.getEligibleStaffMembers();
  res.json(staff);
});

/** GET /api/staff/:id */
export const getStaffById = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
  const member = await service.getStaffMember(id);
  if (!member) {
    res.status(404).json({ error: "Staff member not found" });
    return;
  }
  res.json(member);
});

/** POST /api/staff/from-application/:applicationId
 *  Body: { section: string, role: string }
 */
export const createFromApplication = asyncHandler(async (req: Request, res: Response) => {
  const applicationId = req.params["applicationId"] as string;
  const { section, role } = req.body as { section: string; role: string };

  if (!section || !role) {
    res.status(400).json({ error: "section and role are required" });
    return;
  }

  const member = await service.createStaffFromApplication(applicationId, section, role);
  auditLog(req, "CREATE", "STAFF", `Created staff from application: ${applicationId}`, {
    resourceId: String((member as any).id ?? ""),
    details: {
      applicationId,
      fullName: (member as any).fullName,
      section,
      role,
    },
  });
  res.status(201).json(member);
});

/** DELETE /api/staff/:id */
export const deleteStaff = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params["id"] as string;
  await service.deleteStaffMember(id);
  auditLog(req, "DELETE", "STAFF", `Deleted staff member: ${id}`, { resourceId: id });
  res.status(204).send();
});

/** PATCH /api/staff/:id */
export const updateStaff = asyncHandler(async (req: Request, res: Response) => {
  const id = req.params["id"] as string;

  const patch = req.body as Partial<{
    fullName: string;
    email: string;
    studentId: string | null;
    yearLevel: string | null;
    collegeId: string | null;
    programId: string | null;
    positionId: string | null;
    subRole: string | null;
    assignedSection: string | null;
    assignedRole: string | null;
  }>;

  const member = await service.updateStaffMember(id, patch);
  auditLog(req, "UPDATE", "STAFF", `Updated staff member: ${id}`, {
    resourceId: id,
    details: { fields: Object.keys(patch) },
  });
  res.json(member);
});
