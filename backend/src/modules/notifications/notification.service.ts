import { Response } from "express";
import * as repository from "./notification.repository";
import * as settingsService from "../settings/settings.service";

export const NOTIFICATIONS_UPDATED_EVENT = "notifications:updated";
const updateFrame = `event: ${NOTIFICATIONS_UPDATED_EVENT}\ndata: {}\n\n`;
const MAX_CLIENTS = 128;
const MAX_CLIENTS_PER_ACCOUNT = 8;
const COALESCE_MS = 50;

interface ClientState {
  authorize: () => Promise<boolean>;
  account: string;
  pending: boolean;
  heartbeatPending: boolean;
  processing: boolean;
  scheduled?: NodeJS.Timeout;
  heartbeat: NodeJS.Timeout;
  close: () => void;
  error: () => void;
}

const clients = new Map<Response, ClientState>();
let closingStreams = false;

// Keep one authorization/write task per stream, even during a burst of saves.
async function flushClient(res: Response, state: ClientState): Promise<void> {
  if (state.processing || clients.get(res) !== state) return;
  state.processing = true;
  try {
    const update = state.pending;
    state.pending = false;
    state.heartbeatPending = false;
    if (!await state.authorize() || res.writableEnded || res.destroyed) {
      closeClient(res);
      return;
    }
    if (clients.get(res) !== state) return;
    // Only invalidate. Details always come from the authenticated, bounded GET.
    if (!res.write(update ? updateFrame : ": heartbeat\n\n")) {
      // Never build an unbounded write queue for a stalled browser/proxy.
      closeClient(res, true);
    }
  } catch {
    closeClient(res, true);
  } finally {
    state.processing = false;
    if (state.pending || state.heartbeatPending) scheduleClient(res, state);
  }
}

function scheduleClient(res: Response, state: ClientState): void {
  if (state.processing || state.scheduled || clients.get(res) !== state) return;
  state.scheduled = setTimeout(() => {
    delete state.scheduled;
    void flushClient(res, state);
  }, COALESCE_MS);
  state.scheduled.unref();
}

function closeClient(res: Response, destroy = false): void {
  removeClient(res);
  try {
    if (destroy) res.destroy();
    else if (!res.writableEnded) res.end();
  } catch {
    // Closing a failed transport must never escape a background task.
  }
}

export function closeNotificationStreams(): void {
  closingStreams = true;
  for (const res of clients.keys()) closeClient(res);
}

/** Admission is bounded before the controller sends stream headers. */
export function addClient(
  res: Response,
  authorize: () => Promise<boolean>,
  account = "unknown",
): boolean {
  if (closingStreams) return false;
  if (clients.has(res)) return true;
  if (clients.size >= MAX_CLIENTS ||
      [...clients.values()].filter(client => client.account === account).length >= MAX_CLIENTS_PER_ACCOUNT) {
    return false;
  }
  const heartbeat = setInterval(() => {
    const state = clients.get(res);
    if (!state) return;
    state.heartbeatPending = true;
    scheduleClient(res, state);
  }, 25_000);
  heartbeat.unref();
  const state: ClientState = {
    authorize, account, pending: true, heartbeatPending: false,
    processing: false, heartbeat, close: () => removeClient(res),
    error: () => closeClient(res, true),
  };
  clients.set(res, state);
  res.once("close", state.close);
  res.once("error", state.error);
  scheduleClient(res, state);
  return true;
}

export function removeClient(res: Response): void {
  const state = clients.get(res);
  if (!state) return;
  clients.delete(res);
  clearInterval(state.heartbeat);
  if (state.scheduled) clearTimeout(state.scheduled);
  res.off("close", state.close);
  res.off("error", state.error);
}

function broadcastUpdated(): void {
  for (const [res, state] of clients) {
    state.pending = true;
    scheduleClient(res, state);
  }
}

export async function getUnread() {
  return repository.findUnread();
}

export async function create(message: string, type: string = "info") {
  const boundedMessage = message.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 500);
  if (!boundedMessage) throw new Error("Notification message required");
  const boundedType = /^[a-z][a-z0-9-]{0,49}$/.test(type) ? type : "info";
  const notification = await repository.create(boundedMessage, boundedType);
  broadcastUpdated();
  return notification;
}

export async function createForEvent(
  event: "application" | "articleCreated" | "articlePublished",
  message: string,
  type: string = "info",
) {
  if (!await settingsService.shouldCreateNotification(event)) return null;
  return create(message, type);
}

export async function markAllRead() {
  await repository.markAllRead();
  broadcastUpdated();
}
