import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./user.service";
import * as sessionRepository from "../auth/session.repository";
import { auditLog } from "../activity-logs/activity-log.audit";
import { emitUserAccountsUpdated } from "../../realtime/socket.events";

/** GET /api/users (admin) */
export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.listManagedUsers());
});

/** GET /api/users/eligible-staff (active-board staff without an account) */
export const listEligibleStaff = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await service.listEligibleAdminStaff());
});

/** GET /api/users/:id (admin) */
export const getUserById = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.params as any).id);
  const user = await service.getUserById(id);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(service.toPublicUser(user));
});

/** POST /api/users (admin) */
export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { username, password, role, staffId } = req.body as any;
  const user = await service.createUser({ username, password, role, staffId });
  auditLog(req, "CREATE", "USERS", `Created user: ${user.username}`, {
    resourceId: user.id,
    details: { username: user.username, role: user.role, staffId: user.staffId ?? null },
  });
  emitUserAccountsUpdated();
  res.status(201).json(service.toPublicUser(user));
});

/** PATCH /api/users/:id (admin) */
export const patchUser = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.params as any).id);
  const { password, role, staffId, isActive } = req.body as any;

  if (req.user?.sub === id && isActive === false) {
    res.status(409).json({ error: "You cannot deactivate your own account" });
    return;
  }

  const updated = await service.updateUser(id, {
    password,
    role,
    staffId,
    isActive,
  });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (
    password !== undefined ||
    role !== undefined ||
    isActive === false
  ) {
    await sessionRepository.revokeAllOtherSessions(id);
  }
  auditLog(req, "UPDATE", "USERS", `Updated user: ${updated.username}`, {
    resourceId: updated.id,
    details: { fields: Object.keys(req.body as Record<string, unknown>) },
  });
  emitUserAccountsUpdated();
  res.json(service.toPublicUser(updated));
});
