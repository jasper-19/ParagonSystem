import fs from "fs";
import path from "path";
import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate } from "../../middlewares/validate";
import { updateMediaSchema } from "./media.schema";
import * as controller from "./media.controller";

const router = Router();

const mediaUploadDir = path.resolve(process.cwd(), "uploads", "media");
fs.mkdirSync(mediaUploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, mediaUploadDir),
  filename: (_req: any, file: any, cb: any) => {
    const safeOriginal = path.basename(file.originalname).replace(/\s+/g, "-");
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${safeOriginal}`);
  },
});

const maxSizeMb = Number(process.env.MEDIA_MAX_FILE_SIZE_MB || "25");
const upload = multer({
  storage,
  limits: { fileSize: Math.max(1, maxSizeMb) * 1024 * 1024 },
});

router.get("/:id/file", controller.getMediaFile);

router.get("/", authenticate, requireAdmin, controller.getMedia);
router.post("/upload", authenticate, requireAdmin, upload.single("file"), controller.uploadMedia);
router.patch("/:id", authenticate, requireAdmin, validate(updateMediaSchema), controller.updateMedia);
router.delete("/:id", authenticate, requireAdmin, controller.deleteMedia);

export default router;
