import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./application.controller";
import { validate, validateParams } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { idParamSchema } from "../../schemas/common.schema";
import {
  createApplicationSchema,
  updateStatusSchema,
  scheduleInterviewSchema,
  interviewNotesSchema,
  acceptApplicationSchema,
  assignApplicationSchema,
  updateApplicationSettingsSchema
} from "./application.schema";

const router = Router();

// Stricter rate limit specifically for new application submissions: 5 per hour per IP
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many application submissions. Please try again later." },
});

// GET    /api/applications/settings  – public: retrieve application settings
router.get("/settings", controller.getApplicationSettings);

// POST   /api/applications  – public: anyone can submit an application
router.post("/", submitLimiter, validate(createApplicationSchema), controller.createApplication);

// All routes below are admin-only
router.use(authenticate, requireAdmin);

router.patch("/settings", validate(updateApplicationSettingsSchema), controller.updateApplicationSettings);

router.get("/", controller.getApplications);

router.get("/:id", validateParams(idParamSchema), controller.getApplicationById);

router.patch(
  "/:id/status",
  validateParams(idParamSchema),
  validate(updateStatusSchema),
  controller.updateStatus
);

router.patch(
  "/:id/interview",
  validateParams(idParamSchema),
  validate(scheduleInterviewSchema),
  controller.scheduleInterview
);

router.patch(
  "/:id/interview-complete",
  validateParams(idParamSchema),
  controller.markInterviewed
);

router.patch(
  "/:id/interview-notes",
  validateParams(idParamSchema),
  validate(interviewNotesSchema),
  controller.addInterviewNotes
);

router.patch(
  "/:id/accept",
  validateParams(idParamSchema),
  validate(acceptApplicationSchema),
  controller.acceptApplication
);

router.patch("/:id/reject", validateParams(idParamSchema), controller.rejectApplication);

router.patch(
  "/:id/assign",
  validateParams(idParamSchema),
  validate(assignApplicationSchema),
  controller.assignApplication
);

router.delete("/:id", validateParams(idParamSchema), controller.deleteApplication);

export default router;
