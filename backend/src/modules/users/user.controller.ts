import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./user.service";

/** GET /api/users (admin) */
export const listUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await service.listUsers();
  res.json(users.map(service.toPublicUser));
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
  res.status(201).json(service.toPublicUser(user));
});

/** PATCH /api/users/:id (admin) */
export const patchUser = asyncHandler(async (req: Request, res: Response) => {
  const id = String((req.params as any).id);
  const { password, role, staffId } = req.body as any;

  const updated = await service.updateUser(id, { password, role, staffId });
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(service.toPublicUser(updated));
});
