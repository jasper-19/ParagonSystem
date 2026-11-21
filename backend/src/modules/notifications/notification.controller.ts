import { Request, Response } from "express";
import * as service from "./notification.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { auditLog } from "../activity-logs/activity-log.audit";
import { getAuthToken } from "../../security/auth-token";
import { authorizeLiveAdmin } from "../../security/live-session";

/** GET /api/notifications */
export const getNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const notifications = await service.getUnread();
  res.setHeader("Cache-Control", "no-store");
  res.json(notifications);
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await service.markAllRead();
  await auditLog(req, "READ_ALL", "NOTIFICATIONS", "Marked all notifications as read");
  res.status(204).send();
});

/**
 * GET /api/notifications/stream
 * Server-Sent Events endpoint authenticated by the HttpOnly session cookie.
 */
export function streamNotifications(req: Request, res: Response): void {
  const token = getAuthToken(req)?.token;
  const authorize = () => token ? authorizeLiveAdmin(token) : Promise.resolve(false);
  if (!service.addClient(res, authorize, req.user?.sub)) {
    res.setHeader("Retry-After", "5");
    res.status(503).json({ error: "Notification stream capacity reached. Please retry shortly." });
    return;
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering if proxied
  try { res.flushHeaders(); }
  catch { service.removeClient(res); res.destroy(); }
}
