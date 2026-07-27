import { NextFunction, Request, Response, Router } from "express";
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

async function configuredUpload(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { publishingMedia } = await settingsService.getSettings();
    const allowedMimeTypes = new Set(publishingMedia.allowedMimeTypes);
    const upload = multer({
      storage,
      limits: {
        fileSize: publishingMedia.maxUploadSizeMb * 1024 * 1024,
        files: 1,
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

    upload(req, res, (error: any) => {
      if (error?.code === "LIMIT_FILE_SIZE") {
        Object.assign(error, { statusCode: 413 });
      }
      next(error);
    });
  } catch (error) {
    next(error);
  }
}

router.get("/:id/file", validateParams(idParamSchema), controller.getMediaFile);

router.get("/", authenticate, requireAdmin, controller.getMedia);
router.post("/upload", authenticate, requireAdmin, configuredUpload, controller.uploadMedia);
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
