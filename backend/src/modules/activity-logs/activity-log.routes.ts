import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validateQuery } from "../../middlewares/validate";
import { activityLogQuerySchema } from "./activity-log.schema";
import * as controller from "./activity-log.controller";

const router = Router();

router.get(
  "/filter-options",
  authenticate,
  requireAdmin,
  controller.getActivityLogFilterOptions
);

router.get(
  "/",
  authenticate,
  requireAdmin,
  validateQuery(activityLogQuerySchema),
  controller.getActivityLogs
);

export default router;
