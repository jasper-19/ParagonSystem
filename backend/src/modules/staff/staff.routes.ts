import { Router } from "express";
import * as controller from "./staff.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requireAdmin } from "../../middlewares/requireAdmin";
import { validate, validateParams } from "../../middlewares/validate";
import {
  applicationIdParamSchema,
  idParamSchema,
} from "../../schemas/common.schema";
import {
  createStaffFromApplicationSchema,
  updateStaffSchema,
} from "./staff.schema";

const router = Router();

router.use(authenticate, requireAdmin);

router.get("/", controller.getStaff);

// Must be declared before /:id to avoid the param route swallowing it
router.get("/eligible-for-board", controller.getEligibleStaff);

router.get("/:id", validateParams(idParamSchema), controller.getStaffById);

router.patch(
  "/:id",
  validateParams(idParamSchema),
  validate(updateStaffSchema),
  controller.updateStaff
);

router.post(
  "/from-application/:applicationId",
  validateParams(applicationIdParamSchema),
  validate(createStaffFromApplicationSchema),
  controller.createFromApplication
);

router.delete("/:id", validateParams(idParamSchema), controller.deleteStaff);

export default router;
