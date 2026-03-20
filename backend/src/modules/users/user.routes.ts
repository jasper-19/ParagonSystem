import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate } from "../../middlewares/validate";
import { createUserSchema, updateUserSchema } from "./user.schema";
import * as controller from "./user.controller";

const router = Router();

router.get("/", authenticate, requireAdmin, controller.listUsers);
router.get("/:id", authenticate, requireAdmin, controller.getUserById);
router.post("/", authenticate, requireAdmin, validate(createUserSchema), controller.createUser);
router.patch("/:id", authenticate, requireAdmin, validate(updateUserSchema), controller.patchUser);

export default router;

