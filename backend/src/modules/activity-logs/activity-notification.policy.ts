import type { NotificationSettings } from "../settings/settings.types";

// Server-owned descriptions only. Never copy audit descriptions, names or bodies.
const messages: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  ARTICLES: {
    CREATE: "An article was created.", UPDATE: "An article was updated.",
    PUBLISH: "An article was published.", ARCHIVE: "An article was archived.", DELETE: "An article was deleted.",
  },
  APPLICATIONS: {
    CREATE: "A new staff application was received.", UPDATE_STATUS: "An application status was changed.",
    SCHEDULE_INTERVIEW: "An application interview was scheduled.", MARK_INTERVIEWED: "An application interview was completed.",
    ADD_NOTES: "Application interview notes were updated.", ACCEPT: "An application was accepted.",
    REJECT: "An application was rejected.", DELETE: "An application was deleted.",
    ASSIGN: "An applicant was assigned to staff.", UPDATE: "Staff application settings were updated.",
  },
  STAFF: { CREATE: "A staff member was added.", UPDATE: "A staff profile was updated.", DELETE: "A staff member was removed." },
  EDITORIAL_BOARDS: {
    CREATE: "An editorial board was created.", ACTIVATE: "An editorial board was activated.", DELETE: "An editorial board was deleted.",
    ADD_MEMBER: "A member was added to an editorial board.", ASSIGN_APPLICATION: "An applicant was assigned to an editorial board.",
    UPDATE_MEMBER: "An editorial board assignment was updated.", REMOVE_MEMBER: "An editorial board member was removed.",
    REVOKE_MEMBER: "An editorial board membership was revoked.", SATISFY: "An editorial board completion status was updated.",
  },
  MEDIA: { UPLOAD: "A media file was uploaded.", UPDATE: "A media file was updated.", DELETE: "A media file was deleted." },
  SPECIAL_ISSUES: {
    CREATE: "A special issue was created.", UPDATE: "A special issue was updated.", REPLACE_PDF: "A special issue PDF was replaced.",
    UPDATE_STATUS: "A special issue publication status was changed.", DELETE: "A special issue was deleted.",
  },
  SYSTEM_SETTINGS: { UPDATE: "System settings were updated." },
  USERS: { CREATE: "An administrator account was created.", UPDATE: "An administrator account was updated." },
  AUTH: {
    CHANGE_PASSWORD: "An account password was changed.", SET_2FA: "Account two-factor authentication settings were changed.",
    REVOKE_OTHER_SESSIONS: "Other account sessions were revoked.", LOGOUT_SESSION: "An account session was revoked.",
    LINK_GOOGLE: "An account was linked to Google.",
  },
};

export interface AuditNotification { message: string; type: string; preference?: keyof NotificationSettings }

export function describeAuditNotification(action: string, module: string, outcome = "success"): AuditNotification | null {
  if (outcome !== "success" || !Object.prototype.hasOwnProperty.call(messages, module)) return null;
  const actions = messages[module]!;
  if (!Object.prototype.hasOwnProperty.call(actions, action)) return null;
  const preference = module === "APPLICATIONS" ? "applicationEvents"
    : module === "ARTICLES" && action === "CREATE" ? "articleCreated"
    : module === "ARTICLES" && action === "PUBLISH" ? "articlePublished" : undefined;
  const type = module === "APPLICATIONS" ? "application" : module === "ARTICLES" ? "article"
    : module === "AUTH" || module === "USERS" ? "security" : "info";
  return { message: actions[action]!, type, ...(preference ? { preference } : {}) };
}

export function notificationEnabled(notice: AuditNotification, settings: NotificationSettings): boolean {
  return settings.inAppEnabled && (!notice.preference || settings[notice.preference]);
}
