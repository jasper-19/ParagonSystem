import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate } from "../../middlewares/validate";
import { createActivityLogSchema } from "./activity-log.schema";
import * as controller from "./activity-log.controller";

const router = Router();

router.get("/", authenticate, requireAdmin, controller.getActivityLogs);
router.post("/", authenticate, requireAdmin, validate(createActivityLogSchema), controller.createActivityLog);

export default router;
