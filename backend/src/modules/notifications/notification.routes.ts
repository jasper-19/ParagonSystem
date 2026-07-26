import { Router } from "express";
import * as controller from "./notification.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";

const router = Router();

// SSE stream authenticates with the HttpOnly session cookie.
router.use(authenticate, requireAdmin);

router.get("/stream", controller.streamNotifications);
router.get("/", controller.getNotifications);
router.patch("/read-all", controller.markAllRead);

export default router;
