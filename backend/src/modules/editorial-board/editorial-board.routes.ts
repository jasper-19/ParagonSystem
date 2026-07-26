import { Router } from "express";
import * as controller from "./editorial-board.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate, validateParams } from "../../middlewares/validate";
import {
  boardIdParamSchema,
  boardMemberParamsSchema,
} from "../../schemas/common.schema";
import {
  addBoardMemberSchema,
  assignApplicationToBoardSchema,
  createBoardSchema,
  satisfyBoardSchema,
  updateBoardMemberSchema,
} from "./editorial-board.schema";

const router = Router();

// ---------- Public ----------
router.get("/active", controller.getActiveBoard);

// ---------- Admin ----------
router.use(authenticate, requireAdmin);

router.get("/active/admin", controller.getActiveBoardAdmin);

router.get("/", controller.getBoards);
router.get("/:boardId", validateParams(boardIdParamSchema), controller.getBoardById);

router.post("/", validate(createBoardSchema), controller.createBoard);

router.put("/:boardId/activate", validateParams(boardIdParamSchema), controller.activateBoard);
router.put(
  "/:boardId/satisfy",
  validateParams(boardIdParamSchema),
  validate(satisfyBoardSchema),
  controller.satisfyBoard
);

router.delete("/:boardId", validateParams(boardIdParamSchema), controller.deleteBoard);

// ---------- Members ----------

router.post(
  "/:boardId/assign-application",
  validateParams(boardIdParamSchema),
  validate(assignApplicationToBoardSchema),
  controller.assignApplication
);

router.get(
  "/:boardId/members",
  validateParams(boardIdParamSchema),
  controller.getMembers
);

router.post(
  "/:boardId/members",
  validateParams(boardIdParamSchema),
  validate(addBoardMemberSchema),
  controller.addMember
);

router.patch(
  "/:boardId/members/:memberId",
  validateParams(boardMemberParamsSchema),
  validate(updateBoardMemberSchema),
  controller.updateMember
);

router.delete(
  "/:boardId/members/:memberId",
  validateParams(boardMemberParamsSchema),
  controller.removeMember
);

router.post(
  "/:boardId/members/:memberId/revoke",
  validateParams(boardMemberParamsSchema),
  controller.revokeMember
);

export default router;
