import { Router } from "express";
import applicationRoutes from "../modules/applications/application.routes";
import staffRoutes from "../modules/staff/staff.routes";
import authRoutes from "../modules/auth/auth.routes";
import editorialBoardRoutes from "../modules/editorial-board/editorial-board.routes";
import notificationRoutes from "../modules/notifications/notification.routes";
import articlesRoutes from "../modules/articles/article.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/applications", applicationRoutes);
router.use("/staff", staffRoutes);
router.use("/editorial-boards", editorialBoardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/articles", articlesRoutes);


export default router;
