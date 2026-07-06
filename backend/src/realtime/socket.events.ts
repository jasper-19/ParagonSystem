import { getIO } from "./socket";

export const SocketEvents = {
  ARTICLES_UPDATED: "articles:updated",
} as const;

export function emitArticlesUpdated() {
    console.log("Broadcasting articles: updated")

  getIO().emit(SocketEvents.ARTICLES_UPDATED);
}