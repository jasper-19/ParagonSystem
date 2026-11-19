import { Request, Response } from "express";
import { UAParser } from "ua-parser-js";
import { User } from "../users/user.types";
import * as userService from "../users/user.service";
import { setLastLogin } from '../users/user.repository';
import * as sessionRepository from "./session.repository";
import { auditLog } from "../activity-logs/activity-log.audit";
import { setAuthCookie, signAuthToken } from "../../security/auth-token";
type ParsedSessionMetadata = {
  browserName?: string; browserVersion?: string; osName?: string; osVersion?: string; deviceType: string;
};
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

export async function completeDbLogin(req: Request, res: Response, dbUser: User, redirectTo?: string): Promise<void> {
  const current = await userService.getUserById(dbUser.id);
  if (!current?.isActive || current.passwordHash !== dbUser.passwordHash || current.authVersion !== dbUser.authVersion ||
      current.role !== dbUser.role || current.staffId !== dbUser.staffId || Boolean(current.twoFaEnabled) !== Boolean(dbUser.twoFaEnabled)) {
    throw Object.assign(new Error("Account changed. Please sign in again."), { statusCode: 401 });
  }
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

    await setLastLogin(dbUser.id);
    const token = signAuthToken({
      subject: dbUser.id,
      role: dbUser.role,
      sid: session.id,
      passwordHash: dbUser.passwordHash,
      authVersion: dbUser.authVersion,
      ...(dbUser.staffId ? { staffId: dbUser.staffId } : {}),
    });
    setAuthCookie(res, token);
    await auditLog(req, "LOGIN", "AUTH", `User login: ${dbUser.username}`, {
      resourceId: dbUser.id,
      userId: dbUser.id,
      details: { role: dbUser.role, sessionId: session.id },
    });
    if (redirectTo) res.redirect(303, redirectTo);
    else res.json({ ok: true });
    return;
}
