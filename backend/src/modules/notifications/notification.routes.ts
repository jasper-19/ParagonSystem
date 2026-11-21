import { Router } from "express";
import * as controller from "./notification.controller";
import { authenticate, authenticatePassive } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";

const router = Router();

// SSE stream authenticates with the HttpOnly session cookie.
router.get("/stream", authenticatePassive, requireAdmin, controller.streamNotifications);
router.get("/", authenticatePassive, requireAdmin, controller.getNotifications);
router.patch("/read-all", authenticate, requireAdmin, controller.markAllRead);

export default router;
