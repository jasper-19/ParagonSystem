import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate } from "../../middlewares/validate";
import * as controller from "./settings.controller";
import {
  generalSettingsUpdateSchema,
  maintenanceSettingsUpdateSchema,
  notificationSettingsUpdateSchema,
  publishingMediaSettingsUpdateSchema,
} from "./settings.schema";

const router = Router();

router.get("/public", controller.getPublicSettings);
router.get("/", authenticate, requireAdmin, controller.getSettings);
router.patch(
  "/general",
  authenticate,
  requireAdmin,
  validate(generalSettingsUpdateSchema),
  controller.updateGeneral
);
router.patch(
  "/publishing-media",
  authenticate,
  requireAdmin,
  validate(publishingMediaSettingsUpdateSchema),
  controller.updatePublishingMedia
);
router.patch(
  "/notifications",
  authenticate,
  requireAdmin,
  validate(notificationSettingsUpdateSchema),
  controller.updateNotifications
);
router.patch(
  "/maintenance",
  authenticate,
  requireAdmin,
  validate(maintenanceSettingsUpdateSchema),
  controller.updateMaintenance
);

export default router;

