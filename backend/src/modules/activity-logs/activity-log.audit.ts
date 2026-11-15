import { isIP } from "node:net";
import { randomUUID } from "node:crypto";
import { Request } from "express";
import * as activityLogService from "./activity-log.service";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sensitiveKey = /password|secret|token|cookie|authorization|email|full.?name|notes|phone|address|content|buffer|base64/i;
const pending = new Set<Promise<void>>();
const requestIds = new WeakMap<Request, string>();

export function auditRequestId(req: Request): string {
  let id = requestIds.get(req);
  if (!id) { id = randomUUID(); requestIds.set(req, id); }
  return id;
}

function cleanText(value: string, limit = 500): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, limit);
}

// Defense in depth: callers select explicit metadata, never request bodies.
export function sanitizeAuditDetails(value: unknown, depth = 0, budget = { remaining: 100 }): unknown {
  if (depth > 4 || --budget.remaining < 0) return "[TRUNCATED]";
  if (typeof value === "string") return cleanText(value);
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeAuditDetails(item, depth + 1, budget));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [
      cleanText(key, 100),
      sensitiveKey.test(key) && !(/^(passwordChanged|notesChanged)$/i.test(key) && typeof item === "boolean")
        ? "[REDACTED]" : sanitizeAuditDetails(item, depth + 1, budget),
    ]));
  }
  return null;
}

/** Await before success responses. Failure must not misrepresent a committed mutation as failed. */
export function auditLog(
  req: Request,
  action: string,
  resourceType: string,
  description: string,
  options: { resourceId?: string; details?: Record<string, unknown>; userId?: string;
    outcome?: "success" | "failure" } = {}
): Promise<void> {
  const candidate = req.user?.sub ?? options.userId;
  const subject = candidate && (candidate === "env-admin" || uuid.test(candidate)) ? candidate : undefined;
  const actorUserId = subject && uuid.test(subject) ? subject : undefined;
  const resourceId = options.resourceId && uuid.test(options.resourceId) ? options.resourceId : undefined;
  const requestIp = req.ip && isIP(req.ip) ? req.ip : undefined;
  const userAgent = req.get("user-agent");
  const details = sanitizeAuditDetails(options.details ?? {}) as Record<string, unknown>;
  for (const key of ["description", "requestId", "actorType", "actorSubject", "actorRole", "resourceKey", "outcome"]) {
    delete details[key];
  }
  const requestId = auditRequestId(req);

  const write = (async () => {
    try {
      await activityLogService.createActivityLog({
        ...(actorUserId ? { userId: actorUserId } : {}),
        action: cleanText(action, 100),
        resourceType: cleanText(resourceType, 50),
        ...(resourceId ? { resourceId } : {}),
        details: {
          ...details,
          description: cleanText(description), requestId, outcome: options.outcome ?? "success",
          actorType: subject === "env-admin" ? "environment_admin" : actorUserId ? "user" : "anonymous",
          ...(subject ? { actorSubject: cleanText(subject, 100) } : {}),
          ...(req.user?.role ? { actorRole: req.user.role } : subject === "env-admin" ? { actorRole: "admin" } : {}),
          ...(!resourceId && options.resourceId ? { resourceKey: cleanText(options.resourceId, 100) } : {}),
        },
        ...(requestIp ? { ipAddress: requestIp } : {}),
        ...(userAgent ? { userAgent: cleanText(userAgent, 1024) } : {}),
      });
    } catch (error) {
      // DB errors can contain SQL, credentials or PII. Emit only a bounded error code.
      const code = (error as { code?: unknown } | null)?.code;
      console.error("[AUDIT_WRITE_FAILED]", JSON.stringify({
        action: cleanText(action, 100), module: cleanText(resourceType, 50), requestId,
        code: typeof code === "string" && /^[A-Z0-9_]{1,40}$/.test(code) ? code : "UNKNOWN",
      }));
    }
  })();
  pending.add(write);
  void write.then(() => pending.delete(write), () => pending.delete(write));
  return write;
}

/** HTTP has stopped accepting requests before this is called. DB timeouts bound pending writes. */
export async function drainAuditLogs(): Promise<void> {
  while (pending.size) await Promise.all([...pending]);
}
