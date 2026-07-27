import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./special-issue.controller";
import {
  validate,
  validateParams,
  validateQuery,
} from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { idParamSchema } from "../../schemas/common.schema";
import {
  updateIssueSchema,
  updateIssueStatusSchema,
  specialIssueListQuerySchema,
} from "./special-issue.schema";
import {
  parseSpecialIssuePdfUpload,
  requireSpecialIssuePdf,
  validateSpecialIssueCreateRequest,
} from "./special-issue-upload.middleware";
import { pdfConfig } from "../../config/pdf";

const router = Router();

/** PUBLIC */

router.get(
  "/",
  validateQuery(specialIssueListQuerySchema),
  controller.getIssues
);

router.get(
  "/type/:type",
  validateQuery(specialIssueListQuerySchema),
  controller.getIssuesByType
);

router.get(
  "/admin",
  authenticate,
  requireAdmin,
  validateQuery(specialIssueListQuerySchema),
  controller.getAdminIssues
);

router.get(
  "/admin/:slug",
  authenticate,
  requireAdmin,
  controller.getAdminIssueBySlug
);

router.get("/:slug", controller.getIssueBySlug);

/** ADMIN */

router.use(authenticate, requireAdmin);

const specialIssueUploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: pdfConfig.uploadRateLimitPer15Minutes,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many Special Issue upload attempts. Please try again later.",
  },
});

router.post(
  "/",
  specialIssueUploadLimiter,
  parseSpecialIssuePdfUpload,
  validateSpecialIssueCreateRequest,
  controller.createIssue
);

router.patch(
  "/:id/pdf",
  validateParams(idParamSchema),
  specialIssueUploadLimiter,
  parseSpecialIssuePdfUpload,
  requireSpecialIssuePdf,
  controller.replaceIssuePdf
);

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
