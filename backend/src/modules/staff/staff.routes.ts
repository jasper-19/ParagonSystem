import { Router } from "express";
import * as controller from "./staff.controller";
import { authenticate } from "../../middlewares/authenticate";

const router = Router();

router.get("/", authenticate, controller.getStaff);

// Must be declared before /:id to avoid the param route swallowing it
router.get("/eligible-for-board", authenticate, controller.getEligibleStaff);

router.get("/:id", authenticate, controller.getStaffById);

router.post("/from-application/:applicationId", authenticate, controller.createFromApplication);

router.delete("/:id", authenticate, controller.deleteStaff);

export default router;