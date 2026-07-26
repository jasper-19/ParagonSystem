import { Request, Response } from "express";
import * as service from "./notification.service";
import { asyncHandler } from "../../utils/asyncHandler";
import { auditLog } from "../activity-logs/activity-log.audit";

/** GET /api/notifications */
export const getNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const notifications = await service.getUnread();
  res.json(notifications);
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await service.markAllRead();
  auditLog(req, "READ_ALL", "NOTIFICATIONS", "Marked all notifications as read");
  res.status(204).send();
});

/**
 * GET /api/notifications/stream
 * Server-Sent Events endpoint authenticated by the HttpOnly session cookie.
 */
export function streamNotifications(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Accel-Buffering", "no"); // disable Nginx buffering if proxied
  res.flushHeaders();

  // Send a heartbeat comment every 25 s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* client disconnected */ }
  }, 25_000);

  service.addClient(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    service.removeClient(res);
  });
}
