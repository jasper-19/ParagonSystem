import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import * as service from "./notification.service";
import { asyncHandler } from "../../utils/asyncHandler";

/** GET /api/notifications */
export const getNotifications = asyncHandler(async (_req: Request, res: Response) => {
  const notifications = await service.getUnread();
  res.json(notifications);
});

/** PATCH /api/notifications/read-all */
export const markAllRead = asyncHandler(async (_req: Request, res: Response) => {
  await service.markAllRead();
  res.status(204).send();
});

/**
 * GET /api/notifications/stream?token=<jwt>
 * Server-Sent Events endpoint. EventSource cannot send headers, so the JWT
 * is accepted as a query parameter and verified here.
 */
export function streamNotifications(req: Request, res: Response): void {
  const token = req.query["token"] as string | undefined;
  const secret = process.env["JWT_SECRET"];

  if (!token || !secret) {
    res.status(401).end();
    return;
  }

  try {
    jwt.verify(token, secret);
  } catch {
    res.status(401).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
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
