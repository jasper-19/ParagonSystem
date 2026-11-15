import { RequestHandler } from "express";
import { auditLog, auditRequestId } from "./activity-log.audit";

const modules = new Map<string, string>(Object.entries({
  auth: "AUTH", users: "USERS", articles: "ARTICLES", applications: "APPLICATIONS",
  staff: "STAFF", "editorial-board": "EDITORIAL_BOARDS", "special-issues": "SPECIAL_ISSUES",
  media: "MEDIA", settings: "SYSTEM_SETTINGS", "activity-logs": "ACTIVITY_LOGS",
  notifications: "NOTIFICATIONS", colleges: "COLLEGES", dashboard: "DASHBOARD",
}));

/** Register before guards; capture denials without recording credentials or raw URLs. */
export const auditRequestFailures: RequestHandler = (req, res, next) => {
  const module = modules.get(req.path.split("/")[1] ?? "") ?? "SYSTEM";
  auditRequestId(req);
  res.once("finish", () => {
    const status = res.statusCode;
    if (status < 400) return;
    const mutation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    const action = status === 401 ? "AUTHENTICATION_FAILED"
      : status === 403 ? "ACCESS_DENIED"
      : status === 429 ? "RATE_LIMITED"
      : mutation ? "REQUEST_FAILED" : undefined;
    if (!action) return;
    void auditLog(req, action, module, `${req.method} ${module} request failed (${status})`, {
      outcome: "failure",
      details: {
        method: req.method, status,
        ...(typeof req.route?.path === "string" ? { route: req.route.path } : {}),
      },
    });
  });
  next();
};
