import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate, validateParams } from "../../middlewares/validate";
import { createUserSchema, updateUserSchema } from "./user.schema";
import * as controller from "./user.controller";
import { idParamSchema } from "../../schemas/common.schema";

const router = Router();

router.get("/", authenticate, requireAdmin, controller.listUsers);
router.get(
  "/:id",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  controller.getUserById
);
router.post("/", authenticate, requireAdmin, validate(createUserSchema), controller.createUser);
router.patch(
  "/:id",
  authenticate,
  requireAdmin,
  validateParams(idParamSchema),
  validate(updateUserSchema),
  controller.patchUser
);

export default router;
