import { ADMIN_SOCKET_ROOM, getIO } from "./socket";
import { SettingsSection } from "../modules/settings/settings.types";

export const SocketEvents = {
  ARTICLES_UPDATED: "articles:updated",
  SPECIAL_ISSUES_UPDATED: "special-issues:updated",
  APPLICATIONS_UPDATED: "applications:updated",
  MEDIA_UPDATED: "media:updated",
  APPLICATION_SETTINGS_UPDATED: "applications:settings-updated",
  EDITORIAL_BOARD_UPDATED: "editorial-board:updated",
  ACTIVITY_LOGS_UPDATED: "activity-logs:updated",
  GLOBAL_SETTINGS_UPDATED: "settings:updated",
  USER_ACCOUNTS_UPDATED: "users:updated",
} as const;

// Public invalidation only: never broadcast issue details or draft metadata.
export function emitSpecialIssuesUpdated(): void {
  try {
    getIO().emit(SocketEvents.SPECIAL_ISSUES_UPDATED);
  } catch {
    // A transport outage must not fail an already committed save. Readers
    // fetch the published catalogue again when their socket reconnects.
  }
}

export async function completeSpecialIssueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = await operation();
  emitSpecialIssuesUpdated();
  return result;
}

export type ArticlesUpdatedPayload = {
  articleId?: string;
  previousSlug?: string;
  currentSlug?: string;
};

export type ActivityLogsUpdatedPayload = {
  activityLogId?: string;
  action?: string;
  module?: string;
};

export type GlobalSettingsUpdatedPayload = {
  section: SettingsSection;
  version: number;
  updatedAt: string;
};

export function emitArticlesUpdated(
  payload: ArticlesUpdatedPayload = {}
): void {
  console.log(
    "Broadcasting articles:updated",
    payload
  );

  getIO().emit(
    SocketEvents.ARTICLES_UPDATED,
    payload
  );
}

export function emitApplicationsUpdated() {
    console.log("Broadcasting applications: updated")
    
  getIO()
    .to(ADMIN_SOCKET_ROOM)
    .emit(SocketEvents.APPLICATIONS_UPDATED);
}

export function emitMediaUpdated() {
    console.log("Broadcasting media: updated")

  getIO()
    .to(ADMIN_SOCKET_ROOM)
    .emit(SocketEvents.MEDIA_UPDATED);
}

export function emitApplicationSettingsUpdated(): void {
  console.log('Broadcasting applications:settings-updated');

  getIO().emit(
    SocketEvents.APPLICATION_SETTINGS_UPDATED
  );
}

export function emitEditorialBoardUpdated(): void {
  console.log('Broadcasting editorial-board:updated');

  getIO().emit(
    SocketEvents.EDITORIAL_BOARD_UPDATED
  );
}

export function emitGlobalSettingsUpdated(
  payload: GlobalSettingsUpdatedPayload
): void {
  console.log("Broadcasting settings:updated", payload);
  getIO().emit(SocketEvents.GLOBAL_SETTINGS_UPDATED, payload);
}

export function emitUserAccountsUpdated(): void {
  console.log("Broadcasting users:updated");
  getIO()
    .to(ADMIN_SOCKET_ROOM)
    .emit(SocketEvents.USER_ACCOUNTS_UPDATED);
}

  export function emitActivityLogsUpdated(
    payload: ActivityLogsUpdatedPayload = {}
  ): void {
    console.log(
      "Broadcasting activity-logs:updated",
      payload
    );

    getIO()
      .to(ADMIN_SOCKET_ROOM)
      .emit(
      SocketEvents.ACTIVITY_LOGS_UPDATED,
      payload
    );
  }
