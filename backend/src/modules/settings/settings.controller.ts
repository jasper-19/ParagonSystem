import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { auditLog } from "../activity-logs/activity-log.audit";
import * as service from "./settings.service";
import { SettingsSection } from "./settings.types";
import { emitGlobalSettingsUpdated } from "../../realtime/socket.events";

function actorId(req: Request): string | null {
  const subject = req.user?.sub;
  return subject && subject !== "env-admin" ? subject : null;
}

export const getPublicSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(await service.getPublicSettings());
  }
);

export const getSettings = asyncHandler(
  async (_req: Request, res: Response) => {
    res.setHeader("Cache-Control", "no-store");
    res.json(await service.getSettings(true));
  }
);

function update(section: SettingsSection) {
  return asyncHandler(async (req: Request, res: Response) => {
    const { data, expectedVersion } = req.body as {
      data: unknown;
      expectedVersion: number;
    };
    const settings = await service.updateSection(
      section,
      data,
      expectedVersion,
      actorId(req)
    );

    auditLog(
      req,
      "UPDATE",
      "SYSTEM_SETTINGS",
      `Updated ${section} settings`,
      {
        resourceId: section,
        details: {
          section,
          fields: Object.keys((data ?? {}) as Record<string, unknown>),
          version: settings.version,
        },
      }
    );
    emitGlobalSettingsUpdated({
      section,
      version: settings.version,
      updatedAt: settings.updatedAt,
    });
    res.setHeader("Cache-Control", "no-store");
    res.json(settings);
  });
}

export const updateGeneral = update("general");
export const updatePublishingMedia = update("publishingMedia");
export const updateNotifications = update("notifications");
export const updateMaintenance = update("maintenance");
