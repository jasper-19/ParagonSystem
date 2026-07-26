import { Router } from "express";
import * as controller from "./special-issue.controller";
import { validate, validateParams } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { idParamSchema } from "../../schemas/common.schema";
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

router.use(authenticate, requireAdmin);

router.post("/", validate(createIssueSchema), controller.createIssue);

router.patch(
  "/:id",
  validateParams(idParamSchema),
  validate(updateIssueSchema),
  controller.updateIssue
);

router.patch(
  "/:id/status",
  validateParams(idParamSchema),
  validate(updateIssueStatusSchema),
  controller.updateIssueStatus
);

router.delete("/:id", validateParams(idParamSchema), controller.deleteIssue);

export default router;
