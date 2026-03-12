import { Router } from "express";
import * as controller from "./notification.controller";
import { authenticate } from "../../middlewares/authenticate";

const router = Router();

// SSE stream — auth via ?token= query param (EventSource cannot send headers)
router.get("/stream", controller.streamNotifications);

router.get("/", authenticate, controller.getNotifications);
router.patch("/read-all", authenticate, controller.markAllRead);

export default router;
