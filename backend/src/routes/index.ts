import { Router } from "express";
import applicationRoutes from "../modules/applications/application.routes";
import staffRoutes from "../modules/staff/staff.routes";
import authRoutes from "../modules/auth/auth.routes";
import editorialBoardRoutes from "../modules/editorial-board/editorial-board.routes";
import notificationRoutes from "../modules/notifications/notification.routes";
import articlesRoutes from "../modules/articles/article.routes";
import specialIssueRoutes from "../modules/special-issues/special-issue.routes";
import userRoutes from "../modules/users/user.routes";
import collegeRoutes from "../modules/colleges/college.routes";
import activityLogRoutes from "../modules/activity-logs/activity-log.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/applications", applicationRoutes);
router.use("/staff", staffRoutes);
router.use("/editorial-boards", editorialBoardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/articles", articlesRoutes);
router.use("/issues", specialIssueRoutes);
router.use("/colleges", collegeRoutes);
router.use("/activity-logs", activityLogRoutes);


export default router;
