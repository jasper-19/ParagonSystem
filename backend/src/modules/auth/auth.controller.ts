import { performance } from "node:perf_hooks";
import { UAParser } from "ua-parser-js";
import { Request, Response } from "express";
import bcrypt from "bcrypt";
import { asyncHandler } from "../../utils/asyncHandler";
import * as userService from "../users/user.service";
import * as staffRepository from "../staff/staff.repository";
import * as sessionRepository from "./session.repository";
import { auditLog } from "../activity-logs/activity-log.audit";
import {
  AuthTokenPayload,
  clearAuthCookie,
  setAuthCookie,
  signAuthToken,
} from "../../security/auth-token";

type ParsedSessionMetadata = {
  browserName?: string;
  browserVersion?: string;
  osName?: string;
  osVersion?: string;
  deviceType: string;
};

const authBenchmarkEnabled =
  process.env
    .AUTH_BENCHMARK_ENABLED ===
  "true";

function setAuthServerTiming(
  res: Response,
  measurements: {
    databaseMs: number;
    mappingMs: number;
    totalMs: number;
  }
): void {
  if (!authBenchmarkEnabled) {
    return;
  }

  const databaseMs =
    measurements.databaseMs
      .toFixed(2);

  const mappingMs =
    measurements.mappingMs
      .toFixed(2);

  const totalMs =
    measurements.totalMs
      .toFixed(2);

  res.setHeader(
    "Server-Timing",
    [
      `db;dur=${databaseMs};desc="Session query"`,
      `map;dur=${mappingMs};desc="Response mapping"`,
      `total;dur=${totalMs};desc="Sessions endpoint"`,
    ].join(", ")
  );

  res.setHeader(
    "X-Auth-Sessions-Duration",
    `${totalMs}ms`
  );
}

function formatBrowserLabel(
  browserName?: string,
  browserVersion?: string
): string {
  const name =
    browserName?.trim() ||
    "Unknown Browser";

  const version =
    browserVersion?.trim();

  if (!version) {
    return name;
  }

  const majorVersion =
    version.split(".")[0];

  return majorVersion
    ? `${name} ${majorVersion}`
    : name;
}

function formatOsLabel(
  osName?: string,
  osVersion?: string
): string {
  const name =
    osName?.trim() ||
    "Unknown OS";

  const version =
    osVersion?.trim();

  return version
    ? `${name} ${version}`
    : name;
}

function formatDeviceLabel(
  deviceType?: string
): string {
  const normalized =
    deviceType
      ?.trim()
      .toLowerCase();

  switch (normalized) {
    case "mobile":
      return "Mobile";

    case "tablet":
      return "Tablet";

    case "desktop":
    case undefined:
    case "":
      return "Desktop";

    default:
      return normalized
        .replace(/_/g, " ")
        .replace(
          /\b\w/g,
          character =>
            character.toUpperCase()
        );
  }
}

function parseSessionMetadata(
  userAgent?: string
): ParsedSessionMetadata {
  if (!userAgent?.trim()) {
    return {
      deviceType: "desktop",
    };
  }

  const parser =
    new UAParser(userAgent);

  const browser =
    parser.getBrowser();

  const os =
    parser.getOS();

  const device =
    parser.getDevice();

  let deviceType =
    "desktop";

  if (device.type === "mobile") {
    deviceType = "mobile";
  } else if (
    device.type === "tablet"
  ) {
    deviceType = "tablet";
  } else if (
    device.type
  ) {
    deviceType =
      device.type;
  }

  return {
    ...(browser.name
      ? {
          browserName:
            browser.name.trim(),
        }
      : {}),

    ...(browser.version
      ? {
          browserVersion:
            browser.version.trim(),
        }
      : {}),

    ...(os.name
      ? {
          osName:
            os.name.trim(),
        }
      : {}),

    ...(os.version
      ? {
          osVersion:
            os.version.trim(),
        }
      : {}),

    deviceType,
  };
}

/**
 * POST /api/auth/login
 * Body: { username: string, password: string }
 * Returns: { token: string }
 */
export const login = asyncHandler(async (req: Request, res: Response) => {
  res.set({
    "Cache-Control": "no-store, private",
    Expires: "0",
    Pragma: "no-cache",
  });

  const { username, password } = req.body as {
    username: string;
    password: string;
  };

  if (!username || !password) {
    res.status(400).json({ error: "username and password are required" });
    return;
  }

  // Prefer DB-backed users. This is the "proper" auth path.
  const dbUser = await userService.authenticate(username, password);
  if (dbUser) {
    const userAgent = req.get("user-agent") || undefined;
    const ipAddress = (req as any).ip as string | undefined;

    let session = await sessionRepository.findReusableSession({
      userId: dbUser.id,
      ...(userAgent ? { userAgent } : {}),
      ...(ipAddress ? { ipAddress } : {}),
    });

    if (!session) {
      const sessionMetadata =
        parseSessionMetadata(
          userAgent
        );

      session =
        await sessionRepository
          .createSession({
            userId:
              dbUser.id,

            ...(userAgent
              ? { userAgent }
              : {}),

            ...(ipAddress
              ? { ipAddress }
              : {}),

            ...sessionMetadata,
          });
    } else {
      const hasStoredMetadata =
        Boolean(
          session.deviceType
        );

      if (
        !hasStoredMetadata &&
        userAgent
      ) {
        const sessionMetadata =
          parseSessionMetadata(
            userAgent
          );

        const updatedSession =
          await sessionRepository
            .updateSessionMetadata(
              session.id,
              sessionMetadata
            );

        if (updatedSession) {
          session = updatedSession;
        } else {
          await sessionRepository
            .touchSession(
              session.id
            );
        }
      } else {
        await sessionRepository
          .touchSession(
            session.id
          );
      }
    }

    const token = signAuthToken({
      subject: dbUser.id,
      role: dbUser.role,
      sid: session.id,
      ...(dbUser.staffId ? { staffId: dbUser.staffId } : {}),
    });
    setAuthCookie(res, token);
    auditLog(req, "LOGIN", "AUTH", `User login: ${dbUser.username}`, {
      resourceId: dbUser.id,
      userId: dbUser.id,
      details: { role: dbUser.role, sessionId: session.id },
    });
    res.json({ ok: true });
    return;
  }

  const envAdminEnabled =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_ENV_ADMIN === "true";
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  const adminStaffId = process.env.ADMIN_STAFF_ID;

  if (!envAdminEnabled || !adminUsername || !adminPasswordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const usernameMatch = username === adminUsername;
  const passwordMatch = await bcrypt.compare(password, adminPasswordHash);

  if (!usernameMatch || !passwordMatch) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signAuthToken({
    subject: "env-admin",
    role: "admin",
    ...(adminStaffId ? { staffId: adminStaffId } : {}),
  });
  setAuthCookie(res, token);
  auditLog(req, "LOGIN", "AUTH", `Env admin login: ${adminUsername}`, {
    details: { username: adminUsername, role: "admin" },
  });

  res.json({ ok: true });
});

/**
 * PATCH /api/auth/password
 * Body: { currentPassword: string, newPassword: string }
 */
export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "currentPassword and newPassword are required" });
    return;
  }

  const payload = (req as Request & { user?: AuthTokenPayload; }).user;
  const subject = payload?.sub;
  const sessionId = payload?.sid;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.status(400).json({
      error:
        "Password change is not supported for env-admin. Update ADMIN_PASSWORD_HASH in your environment instead.",
    });
    return;
  }

  const user = await userService.getUserById(subject);
  if (!user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatch) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  await userService.updateUser(subject, { password: newPassword });
  auditLog(req, "CHANGE_PASSWORD", "AUTH", `Changed password for user ${subject}`, {
    resourceId: subject,
    userId: subject,
  });

  // Revoke all other sessions as a safety measure after a password change.
  await sessionRepository.revokeAllOtherSessions(subject, sessionId);

  res.json({ ok: true });
});

/**
 * PATCH /api/auth/2fa
 * Body: { enabled: boolean }
 */
export const setTwoFaEnabled = asyncHandler(async (req: Request, res: Response) => {
  const enabled = (req.body as any)?.enabled;
  if (typeof enabled !== "boolean") {
    res.status(400).json({ error: "enabled must be a boolean" });
    return;
  }

  if (enabled) {
    res.status(501).json({
      error:
        "Two-factor authentication is unavailable until TOTP or WebAuthn enrollment is configured",
    });
    return;
  }

  const payload = (req as Request & { user?: AuthTokenPayload; }).user;
  const subject = payload?.sub;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.status(400).json({
      error: "2FA preference is not supported for env-admin. Create a DB-backed user instead.",
    });
    return;
  }

  const updated = await userService.updateUser(subject, { twoFaEnabled: enabled });
  if (!updated) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  auditLog(req, "SET_2FA", "AUTH", `Updated 2FA setting for user ${subject}`, {
    resourceId: subject,
    userId: subject,
    details: { enabled },
  });

  res.json({ twoFaEnabled: updated.twoFaEnabled ?? enabled });
});

/**
 * GET /api/auth/sessions
 */
export const listSessions =
  asyncHandler(
    async (
      req: Request,
      res: Response
    ) => {
      const payload =
        (req as any).user as {
          sub?: string;
          sid?: string;
        };

      const subject =
        payload?.sub;

      const currentSessionId =
        payload?.sid;

      if (!subject) {
        res.status(401).json({
          error: "Invalid token",
        });

        return;
      }

      res.set({
        "Cache-Control":
          "no-store, private",
        Pragma:
          "no-cache",
        Expires:
          "0",
      });

      if (
        subject === "env-admin"
      ) {
        res.json({
          sessions: [],
        });

        return;
      }

      const endpointStartedAt =
        performance.now();

      const databaseStartedAt =
        performance.now();

      const sessions =
        await sessionRepository
          .listSessionsByUser(
            subject,
            currentSessionId
          );

      const databaseMs =
        performance.now() -
        databaseStartedAt;

      const mappingStartedAt =
        performance.now();

      const responseSessions =
        sessions.map(
          session => {
            const browser =
              session.browserName
                ?.trim() ||
              "Unknown Browser";

            const browserVersion =
              session.browserVersion
                ?.trim() ||
              "";

            const os =
              session.osName
                ?.trim() ||
              "Unknown OS";

            return {
              id:
                session.id,

              browser,

              browserVersion,

              browserLabel:
                formatBrowserLabel(
                  browser,
                  browserVersion
                ),

              os,

              osLabel:
                formatOsLabel(
                  os,
                  session.osVersion
                ),

              device:
                formatDeviceLabel(
                  session.deviceType
                ),

              userAgent:
                session.userAgent,

              lastActiveAt:
                session.lastActiveAt,

              current:
                currentSessionId ===
                session.id,
            };
          }
        );

      const mappingMs =
        performance.now() -
        mappingStartedAt;

      const totalMs =
        performance.now() -
        endpointStartedAt;

      setAuthServerTiming(
        res,
        {
          databaseMs,
          mappingMs,
          totalMs,
        }
      );

      if (authBenchmarkEnabled) {
        console.log(
          "[AUTH SESSIONS BENCHMARK]",
          {
            sessionCount:
              responseSessions.length,

            databaseMs:
              Number(
                databaseMs.toFixed(2)
              ),

            mappingMs:
              Number(
                mappingMs.toFixed(2)
              ),

            totalMs:
              Number(
                totalMs.toFixed(2)
              ),
          }
        );
      }

      res.json({
        sessions:
          responseSessions,
      });
    }
  );

/**
 * DELETE /api/auth/sessions/:id
 */
export const logoutSession = asyncHandler(async (req: Request, res: Response) => {
    const payload = (req as Request & { user?: AuthTokenPayload; }).user;
    const subject = payload?.sub;

  if (!subject) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  if (subject === "env-admin") {
    res.status(400).json({ error: "Session management is not supported for env-admin" });
    return;
  }

  const sessionId = String(req.params["id"] ?? "");
  if (!sessionId) {
    res.status(400).json({ error: "Session id is required" });
    return;
  }

  await sessionRepository.revokeSession(subject, sessionId);
  if (payload?.sid === sessionId) {
    clearAuthCookie(res);
  }
  auditLog(req, "LOGOUT_SESSION", "AUTH", `Logged out session ${sessionId}`, {
    resourceId: sessionId,
    userId: subject,
    details: { sessionId },
  });
  res.json({ ok: true });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const payload = req.user;

  if (payload?.sub && payload.sub !== "env-admin" && payload.sid) {
    await sessionRepository.revokeSession(payload.sub, payload.sid);
    auditLog(req, "LOGOUT", "AUTH", `User logout: ${payload.sub}`, {
      resourceId: payload.sid,
      userId: payload.sub,
    });
  }

  clearAuthCookie(res);
  res.status(204).send();
});

/**
 * GET /api/auth/me
 * Returns the authenticated user and (if linked) their staff member profile.
 */
export const me = asyncHandler(async (req: Request, res: Response) => {

  const payload = (req as Request & { user?: AuthTokenPayload; }).user;
  const subject = payload?.sub;
  const staffId = payload?.staffId;

  // The verified authentication subject identifies the current account.
  if (!subject) {
    res.status(401).json({
      error: "Invalid token",
    });

    return;
  }

  res.set({
    "Cache-Control":
      "no-store, private",

    Pragma:
      "no-cache",

    Expires:
      "0",
  });

  // Legacy env-backend admin
  if (
    subject === "env-admin"
  ) {
    const username =
      process.env.ADMIN_USERNAME
        ?.trim() ||
      "admin";

    const staff =
      staffId
        ? await staffRepository
            .findById(staffId)
        : undefined;

    res.json({
      user: {
        id: "env-admin",
        username,
        role: "admin",

        ...(staffId
          ? { staffId }
          : {}),
      },

      staff:
        staff ?? null,
    });

    return;
  }

  const profile =
    await userService
      .getUserWithStaffById(
        subject
      );

  if (!profile) {
    res.status(401).json({
      error: "Invalid token",
    });

    return;
  }

  res.json({
    user:
      userService.toPublicUser(
        profile.user
      ),

    staff:
      profile.staff,
  });
});
