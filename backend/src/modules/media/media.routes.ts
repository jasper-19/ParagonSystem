import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate, validateParams } from "../../middlewares/validate";
import { updateMediaSchema } from "./media.schema";
import * as controller from "./media.controller";
import { idParamSchema } from "../../schemas/common.schema";

const router = Router();

const storage = multer.memoryStorage();

const allowedMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/x-wav",
]);

const configuredMaxSizeMb = Number(process.env.MEDIA_MAX_FILE_SIZE_MB || "25");
const maxSizeMb = Number.isFinite(configuredMaxSizeMb)
  ? Math.min(Math.max(configuredMaxSizeMb, 1), 100)
  : 25;
const upload = multer({
  storage,
  limits: { fileSize: maxSizeMb * 1024 * 1024 },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    callback: (error: Error | null, acceptFile?: boolean) => void
  ) => {
    if (!allowedMimeTypes.has(file.mimetype.toLowerCase())) {
      callback(
        Object.assign(new Error("Unsupported media type"), {
          statusCode: 415,
        })
      );
      return;
    }

    callback(null, true);
  },
});

router.get("/:id/file", validateParams(idParamSchema), controller.getMediaFile);

router.get("/", authenticate, requireAdmin, controller.getMedia);
router.post("/upload", authenticate, requireAdmin, upload.single("file"), controller.uploadMedia);
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
