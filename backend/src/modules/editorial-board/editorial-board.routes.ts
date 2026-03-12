import { Router } from "express";
import * as controller from "./editorial-board.controller";
import { authenticate } from "../../middlewares/authenticate";

const router = Router();

// Board routes
router.get("/active", authenticate, controller.getActiveBoard);
router.get("/", authenticate, controller.getBoards);
router.get("/:boardId", authenticate, controller.getBoardById);
router.post("/", authenticate, controller.createBoard);
router.put("/:boardId/activate", authenticate, controller.activateBoard);
router.put("/:boardId/satisfy", authenticate, controller.satisfyBoard);
router.delete("/:boardId", authenticate, controller.deleteBoard);

// Member routes
router.get("/:boardId/members", authenticate, controller.getMembers);
router.post("/:boardId/members", authenticate, controller.addMember);
router.delete("/:boardId/members/:memberId", authenticate, controller.removeMember);
router.post("/:boardId/members/:memberId/revoke", authenticate, controller.revokeMember);

export default router;
