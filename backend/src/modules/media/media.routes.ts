import { Request, Response, Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate, validateParams } from "../../middlewares/validate";
import { updateMediaSchema } from "./media.schema";
import * as controller from "./media.controller";
import { idParamSchema } from "../../schemas/common.schema";
import * as settingsService from "../settings/settings.service";

const router = Router();

const storage = multer.memoryStorage();
let uploadInProgress = false;

async function configuredUpload(req: Request, res: Response): Promise<void> {
  if (res.destroyed || res.headersSent) return;
  if (!req.is("multipart/*")) {
    await controller.uploadMedia(req, res);
    return;
  }
  if (uploadInProgress) {
    res.setHeader("Retry-After", "10");
    res.status(503).json({ error: "Media uploads are busy. Please try again shortly." });
    return;
  }

  // Keep one bounded file and its generated variants in flight per process.
  // An early disconnect must not free the slot while processing is still running.
  uploadInProgress = true;
  try {
    const { publishingMedia } = await settingsService.getSettings();
    if (res.destroyed || res.headersSent) return;
    const allowedMimeTypes = new Set(publishingMedia.allowedMimeTypes);
    const upload = multer({
      storage,
      limits: {
        fileSize: publishingMedia.maxUploadSizeMb * 1024 * 1024,
        files: 1,
        fields: 0,
        parts: 1,
      },
      fileFilter: (
        _req: Request,
        file: { mimetype: string },
        callback: (error: Error | null, acceptFile?: boolean) => void
      ) => {
        if (!allowedMimeTypes.has(file.mimetype.toLowerCase() as never)) {
          callback(
            Object.assign(new Error("Unsupported media type"), {
              statusCode: 415,
            })
          );
          return;
        }
        callback(null, true);
      },
    }).single("file");

    await new Promise<void>((resolve, reject) => {
      upload(req, res, (error?: unknown) => {
        if (error) reject(error);
        else resolve();
      });
    });
    if (!res.destroyed && !res.headersSent) await controller.uploadMedia(req, res);
  } catch (error) {
    if (!res.destroyed && !res.headersSent) throw error;
  } finally {
    uploadInProgress = false;
  }
}

router.get("/:id/file", validateParams(idParamSchema), controller.getMediaFile);

router.get("/", authenticate, requireAdmin, controller.getMedia);
router.post("/upload", authenticate, requireAdmin, configuredUpload);
router.patch(
  "/:id",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateMediaSchema),
  controller.updateMedia
);
router.delete(
  "/:id",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  controller.deleteMedia
);

export default router;
