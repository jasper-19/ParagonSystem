import { Router } from "express";
import * as controller from "./special-issue.controller";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import {
  createIssueSchema,
  updateIssueSchema,
  updateIssueStatusSchema,
} from "./special-issue.schema";

const router = Router();

/** PUBLIC */

router.get("/", controller.getIssues);

router.get("/type/:type", controller.getIssuesByType);

router.get("/:slug", controller.getIssueBySlug);

/** ADMIN */

router.post("/", authenticate, validate(createIssueSchema), controller.createIssue);

router.patch("/:id", authenticate, validate(updateIssueSchema), controller.updateIssue);

router.patch(
  "/:id/status",
  authenticate,
  validate(updateIssueStatusSchema),
  controller.updateIssueStatus
);

router.delete("/:id", authenticate, controller.deleteIssue);

export default router;
