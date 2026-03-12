import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as controller from "./application.controller";
import { validate } from "../../middlewares/validate";
import { authenticate } from "../../middlewares/authenticate";
import {
  createApplicationSchema,
  updateStatusSchema,
  scheduleInterviewSchema,
  interviewNotesSchema,
  acceptApplicationSchema,
  assignApplicationSchema,
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

// POST   /api/applications  – public: anyone can submit an application
router.post("/", submitLimiter, validate(createApplicationSchema), controller.createApplication);

// All routes below are admin-only
router.get("/", authenticate, controller.getApplications);

router.get("/:id", authenticate, controller.getApplicationById);

router.patch("/:id/status", authenticate, validate(updateStatusSchema), controller.updateStatus);

router.patch("/:id/interview", authenticate, validate(scheduleInterviewSchema), controller.scheduleInterview);

router.patch("/:id/interview-complete", authenticate, controller.markInterviewed);

router.patch("/:id/interview-notes", authenticate, validate(interviewNotesSchema), controller.addInterviewNotes);

router.patch("/:id/accept", authenticate, validate(acceptApplicationSchema), controller.acceptApplication);

router.patch("/:id/reject", authenticate, controller.rejectApplication);

router.patch("/:id/assign", authenticate, validate(assignApplicationSchema), controller.assignApplication);

router.delete("/:id", authenticate, controller.deleteApplication);

export default router;