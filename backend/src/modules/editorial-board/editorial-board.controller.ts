import { Request, Response } from "express";
import * as service from "./editorial-board.service";
import * as notificationService from "../notifications/notification.service";
import { auditLog } from "../activity-logs/activity-log.audit";
import { asyncHandler } from "../../utils/asyncHandler";
import { toPublicBoard, toPublicBoardMember } from "./editorial-board.service";
import { assignApplicationToBoardSchema } from "./editorial-board.schema";
import { emitEditorialBoardUpdated } from "../../realtime/socket.events";

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

  res.json(
    toPublicBoard({
      ...board,
      members,
    })
  );
});

/** GET /api/editorial-boards/active/admin */
export const getActiveBoardAdmin = asyncHandler(
  async (_req: Request, res: Response) => {
    const board = await service.getActiveBoard();

    if (!board) {
      res.status(404).json({
        error: "No editorial board found",
      });
      return;
    }

    const members = await service.getBoardMembers(board.id);

    res.json({
      ...board,
      members,
    });
  }
);

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
 *  Body: { academicYear: string, adviserName: string, coAdviserName?: string }
 */
export const createBoard = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const {
      academicYear,
      adviserName,
      coAdviserName,
    } = req.body as {
      academicYear: string;
      adviserName: string;
      coAdviserName?: string;
    };

    const board =
      await service.createBoard(
        academicYear,
        adviserName,
        coAdviserName
      );

    emitEditorialBoardUpdated();

    notificationService
      .create(
        `New editorial board created for ${academicYear}.`,
        "board"
      )
      .catch(() => {});

    auditLog(
      req,
      "CREATE",
      "EDITORIAL_BOARDS",
      `Created editorial board for ${academicYear}`,
      {
        resourceId:
          String(
            (board as any).id ?? ""
          ),
        details: {
          academicYear,
          adviserName,
          coAdviserName: coAdviserName?.trim() || null,
        },
      }
    );

    res.status(201).json(board);
  }
);

/** PUT /api/editorial-boards/:boardId/activate */
export const activateBoard = asyncHandler(
  async (req: Request, res: Response) => {
    const boardId = req.params["boardId"] as string;

    const board = await service.activateBoard(boardId);

    emitEditorialBoardUpdated();

    auditLog(
      req,
      "ACTIVATE",
      "EDITORIAL_BOARDS",
      "Activated the editorial board.",
      {
        resourceId: boardId,
        details: {
          yearLevelTransition:
            (board as any).yearLevelTransition,
        },
      }
    );

    res.json(board);
  }
);

/** DELETE /api/editorial-boards/:boardId */
export const deleteBoard = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const boardId =
      req.params["boardId"] as string;

    await service.deleteBoard(boardId);

    emitEditorialBoardUpdated();

    auditLog(
      req,
      "DELETE",
      "EDITORIAL_BOARDS",
      "Deleted the editorial board.",
      {
        resourceId: boardId,
      }
    );

    res.status(204).send();
  }
);

/** GET /api/editorial-boards/:boardId/members */
export const getMembers = asyncHandler(async (req: Request, res: Response) => {
  const boardId = req.params["boardId"] as string;
  const members = await service.getBoardMembers(boardId);
  res.json(members);
});

/** POST /api/editorial-boards/:boardId/members
 *  Body: { staffId: string, section: string, role: string }
 */
export const addMember = asyncHandler(
  async (req: Request, res: Response) => {
    const boardId = req.params["boardId"] as string;

    const { staffId, section, role } = req.body as {
      staffId: string;
      section: string;
      role: string;
    };

    if (!staffId || !section || !role) {
      res.status(400).json({
        error: "staffId, section, and role are required",
      });
      return;
    }

    const member = await service.addBoardMember(
      boardId,
      staffId,
      section,
      role
    );

    if (await service.isActiveBoard(boardId)) {
      emitEditorialBoardUpdated();
    }

    auditLog(
      req,
      "ADD_MEMBER",
      "EDITORIAL_BOARDS",
      "Added a member to the editorial board.",
      {
        resourceId: String((member as any).id ?? boardId),
        details: {
          boardId,
          staffId,
          section,
          role,
        },
      }
    );

    res.status(201).json(member);
  }
);

/**
 * POST /api/editorial-boards/:boardId/assign-application
 *
 * Atomically:
 * - creates or reuses a staff record;
 * - creates the board membership;
 * - marks the application assigned.
 */
export const assignApplication =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const boardId =
        req.params["boardId"] as string;

      const parsed =
        assignApplicationToBoardSchema
          .safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          error:
            parsed.error.issues[0]
              ?.message ??
            "Invalid assignment request",
          issues:
            parsed.error.flatten(),
        });

        return;
      }

      const result =
        await service
          .assignApplicationToBoard(
            boardId,
            parsed.data
          );

      emitEditorialBoardUpdated();

      auditLog(
        req,
        "ASSIGN_APPLICATION",
        "EDITORIAL_BOARDS",
        "Assigned an accepted applicant to the editorial board.",
        {
          resourceId:
            result.boardMember.id,
          details: {
            boardId,
            applicationId:
              result.application.id,
            staffId:
              result.staff.id,
            section:
              result.boardMember.section,
            role:
              result.boardMember.role,
          },
        }
      );

      notificationService
        .create(
          `${result.staff.fullName} was assigned as ${result.boardMember.role}.`,
          "board"
        )
        .catch(() => {});

      res.status(201).json(result);
    }
  );

/** PATCH /api/editorial-boards/:boardId/members/:memberId
 *  Body: { section: string, role: string }
 */
export const updateMember = asyncHandler(
  async (req: Request, res: Response) => {
    const { boardId, memberId } = req.params as {
      boardId: string;
      memberId: string;
    };

    const { section, role, yearLevel } = req.body as {
      section?: string;
      role?: string;
      yearLevel?: string | null;
    };

    if (!section || !role) {
      res.status(400).json({
        error: "section and role are required",
      });
      return;
    }

    const member = await service.updateBoardMember(
      boardId,
      memberId,
      section,
      role,
      yearLevel
    );

    if (await service.isActiveBoard(boardId)) {
      emitEditorialBoardUpdated();
    }

    auditLog(
      req,
      "UPDATE_MEMBER",
      "EDITORIAL_BOARDS",
      "Updated an editorial board member.",
      {
        resourceId: memberId,
        details: {
          boardId,
          section,
          role,
          yearLevel,
        },
      }
    );

    res.json(member);
  }
);

/** DELETE /api/editorial-boards/:boardId/members/:memberId */
export const removeMember = asyncHandler(
  async (req: Request, res: Response) => {
    const memberId = req.params["memberId"] as string;
    const boardId = req.params["boardId"] as string;

    await service.removeBoardMember(memberId);

    if (await service.isActiveBoard(boardId)) {
      emitEditorialBoardUpdated();
    }

    auditLog(
      req,
      "REMOVE_MEMBER",
      "EDITORIAL_BOARDS",
      "Removed a member from the editorial board.",
      {
        resourceId: memberId,
        details: {
          boardId,
        },
      }
    );

    res.status(204).send();
  }
);

/** POST /api/editorial-boards/:boardId/members/:memberId/revoke
 *  Removes member from board and resets their application to the assignment queue.
 */
export const revokeMember = asyncHandler(
  async (req: Request, res: Response) => {
    const { boardId, memberId } = req.params as {
      boardId: string;
      memberId: string;
    };

    await service.revokeBoardMember(boardId, memberId);

    if (await service.isActiveBoard(boardId)) {
      emitEditorialBoardUpdated();
    }

    auditLog(
      req,
      "REVOKE_MEMBER",
      "EDITORIAL_BOARDS",
      "Revoked a member from the editorial board.",
      {
        resourceId: memberId,
        details: {
          boardId,
        },
      }
    );

    res.status(204).send();
  }
);

/** PUT /api/editorial-boards/:boardId/satisfy
 *  Body: { satisfied: boolean }
 *  Persists the "board satisfied" flag so staff with only 1 assignment
 *  are hidden from the available panel until unsatisfied.
 */
export const satisfyBoard = asyncHandler(
  async (
    req: Request,
    res: Response
  ) => {
    const boardId =
      req.params["boardId"] as string;

    const {
      satisfied,
    } = req.body as {
      satisfied: boolean;
    };

    if (
      typeof satisfied !== "boolean"
    ) {
      res.status(400).json({
        error:
          "satisfied must be a boolean",
      });

      return;
    }

    const board =
      await service.satisfyBoard(
        boardId,
        satisfied
      );

    emitEditorialBoardUpdated();

    auditLog(
      req,
      "SATISFY",
      "EDITORIAL_BOARDS",
      satisfied
        ? "Marked the editorial board as satisfied."
        : "Marked the editorial board as not satisfied.",
      {
        resourceId: boardId,
        details: {
          satisfied,
        },
      }
    );

    res.json(board);
  }
);
