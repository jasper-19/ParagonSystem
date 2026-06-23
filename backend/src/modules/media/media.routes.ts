import { Router } from "express";
import multer from "multer";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate } from "../../middlewares/validate";
import { updateMediaSchema } from "./media.schema";
import * as controller from "./media.controller";

const router = Router();

const storage = multer.memoryStorage()

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
