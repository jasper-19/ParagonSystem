import { Response } from "express";
import * as repository from "./notification.repository";

// ── SSE client registry ───────────────────────────────────────────────────────

const clients = new Set<Response>();

export function addClient(res: Response): void {
  clients.add(res);
}

export function removeClient(res: Response): void {
  clients.delete(res);
}

function broadcast(notification: object): void {
  const data = `data: ${JSON.stringify(notification)}\n\n`;
  for (const client of clients) {
    try { client.write(data); } catch { clients.delete(client); }
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

export async function markAllRead() {
  return repository.markAllRead();
}
