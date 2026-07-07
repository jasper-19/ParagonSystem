import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import * as controller from "./dashboard.controller";

const router = Router();

router.get(
  "/feed",
  authenticate,
  controller.getDashboardFeed
);

export default router;