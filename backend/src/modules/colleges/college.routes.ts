import { Router } from "express";
import * as controller from "./college.controller";

const router = Router();

router.get("/", controller.getColleges);

export default router;

