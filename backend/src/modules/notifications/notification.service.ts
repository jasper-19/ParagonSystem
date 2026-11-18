import { Response } from "express";
import * as repository from "./notification.repository";
import * as settingsService from "../settings/settings.service";

// ── SSE client registry ───────────────────────────────────────────────────────

const clients = new Map<Response, () => Promise<boolean>>();

export function addClient(res: Response, authorize: () => Promise<boolean>): void {
  clients.set(res, authorize);
}

export function removeClient(res: Response): void {
  clients.delete(res);
}

function broadcast(notification: object): void {
  const data = `data: ${JSON.stringify(notification)}\n\n`;
  for (const [client, authorize] of clients) {
    void (async () => {
      try {
        if (await authorize() && clients.has(client) && !client.writableEnded) {
          client.write(data);
        } else {
          clients.delete(client);
          client.end();
        }
      } catch { clients.delete(client); client.end(); }
    })();
  }
}

// ── business logic ────────────────────────────────────────────────────────────

export async function getUnread() {
  return repository.findUnread();
}

export async function create(message: string, type: string = "info") {
  const notification = await repository.create(message, type);
  broadcast(notification);
  return notification;
}

export async function createForEvent(
  event: "application" | "articleCreated" | "articlePublished",
  message: string,
  type: string = "info"
) {
  if (!await settingsService.shouldCreateNotification(event)) {
    return null;
  }
  return create(message, type);
}

export async function markAllRead() {
  return repository.markAllRead();
}
