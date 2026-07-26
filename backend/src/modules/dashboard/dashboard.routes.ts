import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import * as controller from "./dashboard.controller";

const router = Router();

router.get(
  "/feed",
  authenticate,
  requireAdmin,
  controller.getDashboardFeed
);

export default router;
