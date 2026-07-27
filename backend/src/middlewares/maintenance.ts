import { NextFunction, Request, Response } from "express";
import * as sessionRepository from "../modules/auth/session.repository";
import * as settingsService from "../modules/settings/settings.service";
import { getAuthToken, verifyAuthToken } from "../security/auth-token";

async function hasValidAdminSession(req: Request): Promise<boolean> {
  const authToken = getAuthToken(req);
  if (!authToken) return false;

  try {
    const payload = verifyAuthToken(authToken.token);
    if (payload.role !== "admin") return false;
    if (payload.sub === "env-admin") return true;
    if (!payload.sid) return false;
    return sessionRepository.isSessionActive(payload.sid);
  } catch {
    return false;
  }
}

export async function enforceMaintenanceMode(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (
    req.path.startsWith("/auth/") ||
    req.path === "/settings/public" ||
    req.path === "/settings" ||
    req.path.startsWith("/settings/")
  ) {
    next();
    return;
  }

  try {
    const { maintenance } = await settingsService.getSettings();
    if (!maintenance.enabled) {
      next();
      return;
    }

    if (
      maintenance.allowAdminBypass &&
      await hasValidAdminSession(req)
    ) {
      next();
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Retry-After", "900");
    res.status(503).json({
      error: "Service temporarily unavailable",
      maintenance: true,
      message: maintenance.message,
    });
  } catch (error) {
    next(error);
  }
}

