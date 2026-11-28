import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { sanitizeValue } from "../../middlewares/sanitize";
import * as service from "./media.service";
import { auditLog } from "../activity-logs/activity-log.audit";

export const getMedia = asyncHandler(async (req: Request, res: Response) => {
  const rawSearch = req.query["search"];
  const rawType = req.query["type"];
  const rawPage = req.query["page"];
  const rawLimit = req.query["limit"];

  const search = typeof rawSearch === "string" ? String(sanitizeValue(rawSearch)) : undefined;
  const type = typeof rawType === "string" ? String(sanitizeValue(rawType)) : undefined;
  const page = typeof rawPage === "string" ? Number(String(sanitizeValue(rawPage))) : undefined;
  const limit = typeof rawLimit === "string" ? Number(String(sanitizeValue(rawLimit))) : undefined;

  const filters: service.GetMediaFilters = {};
  if (search !== undefined) filters.search = search;
  if (type !== undefined) filters.type = type;
  if (page !== undefined && Number.isFinite(page)) filters.page = page;
  if (limit !== undefined && Number.isFinite(limit)) filters.limit = limit;

  const response = await service.getMedia(filters);
  res.json(response);
});

export async function uploadMedia(req: Request, res: Response): Promise<void> {
  const file = (req as Request & { file?: service.UploadInput }).file;
  const created = await service.createMediaFromUpload(file);
  await auditLog(req, "UPLOAD", "MEDIA", "Uploaded media", {
    resourceId: created.id,
    details: { mimeType: created.mimeType, size: created.size },
  });
  res.status(201).json(created);
}

export const updateMedia = asyncHandler(async (req: Request, res: Response) => {
  const id = String(sanitizeValue(req.params["id"]) || "");
  const updated = await service.updateMedia(id, req.body);
  await auditLog(req, "UPDATE", "MEDIA", "Updated media metadata", {
    resourceId: id, details: { fields: Object.keys(req.body) },
  });
  res.json(updated);
});

export const deleteMedia = asyncHandler(async (req: Request, res: Response) => {
  const id = String(sanitizeValue(req.params["id"]) || "");
  await service.deleteMedia(id, () => auditLog(req, "DELETE", "MEDIA", "Deleted media", { resourceId: id }));
  res.status(204).send();
});

export const getMediaFile = asyncHandler(async (req: Request, res: Response) => {
  const id = String(sanitizeValue(req.params["id"]) || "");
  const mediaFile = await service.getMediaFile(id);
  res.redirect(mediaFile.url);
});
