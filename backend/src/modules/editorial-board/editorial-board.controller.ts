import { Request, Response } from "express";
import * as service from "./editorial-board.service";
import * as notificationService from "../notifications/notification.service";
import { asyncHandler } from "../../utils/asyncHandler";

/** GET /api/editorial-boards */
export const getBoards = asyncHandler(async (_req: Request, res: Response) => {
  const boards = await service.getAllBoards();
  res.json(boards);
});

/** GET /api/editorial-boards/active */
export const getActiveBoard = asyncHandler(async (_req: Request, res: Response) => {
  const board = await service.getActiveBoard();
  if (!board) {
    res.status(404).json({ error: "No editorial board found" });
    return;
  }

  const members = await service.getBoardMembers(board.id);
  res.json({ ...board, members });
});

/** GET /api/editorial-boards/:boardId */
export const getBoardById = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  const board = await service.getBoardById(boardId);
  if (!board) {
    res.status(404).json({ error: "Editorial board not found" });
    return;
  }
  res.json(board);
});

/** POST /api/editorial-boards
 *  Body: { academicYear: string, adviserName: string }
 */
export const createBoard = asyncHandler(async (req: Request, res: Response) => {
  const { academicYear, adviserName } = req.body as { academicYear: string; adviserName: string };
  const board = await service.createBoard(academicYear, adviserName);
  notificationService.create(
    `New editorial board created for ${academicYear}.`,
    "board"
  ).catch(() => {});
  res.status(201).json(board);
});

/** PUT /api/editorial-boards/:boardId/activate */
export const activateBoard = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  const board = await service.activateBoard(boardId);
  res.json(board);
});

/** DELETE /api/editorial-boards/:boardId */
export const deleteBoard = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  await service.deleteBoard(boardId);
  res.status(204).send();
});

/** GET /api/editorial-boards/:boardId/members */
export const getMembers = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  const members = await service.getBoardMembers(boardId);
  res.json(members);
});

/** POST /api/editorial-boards/:boardId/members
 *  Body: { staffId: string, section: string, role: string }
 */
export const addMember = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  const { staffId, section, role } = req.body as { staffId: string; section: string; role: string };

  if (!staffId || !section || !role) {
    res.status(400).json({ error: "staffId, section, and role are required" });
    return;
  }

  const member = await service.addBoardMember(boardId, staffId, section, role);
  res.status(201).json(member);
});

/** PATCH /api/editorial-boards/:boardId/members/:memberId
 *  Body: { section: string, role: string }
 */
export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  const { boardId, memberId } = req.params as { boardId: string; memberId: string };
  const { section, role } = req.body as { section?: string; role?: string };

  if (!section || !role) {
    res.status(400).json({ error: "section and role are required" });
    return;
  }

  const member = await service.updateBoardMember(boardId, memberId, section, role);
  res.json(member);
});

/** DELETE /api/editorial-boards/:boardId/members/:memberId */
export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const memberId = req.params["memberId"] as string;
  await service.removeBoardMember(memberId);
  res.status(204).send();
});

/** POST /api/editorial-boards/:boardId/members/:memberId/revoke
 *  Removes member from board and resets their application to the assignment queue.
 */
export const revokeMember = asyncHandler(async (req: Request, res: Response) => {
  const { boardId, memberId } = req.params as { boardId: string; memberId: string };
  await service.revokeBoardMember(boardId, memberId);
  res.status(204).send();
});

/** PUT /api/editorial-boards/:boardId/satisfy
 *  Body: { satisfied: boolean }
 *  Persists the "board satisfied" flag so staff with only 1 assignment
 *  are hidden from the available panel until unsatisfied.
 */
export const satisfyBoard = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  const { satisfied } = req.body as { satisfied: boolean };
  if (typeof satisfied !== "boolean") {
    res.status(400).json({ error: "satisfied must be a boolean" });
    return;
  }
  const board = await service.satisfyBoard(boardId, satisfied);
  res.json(board);
});
