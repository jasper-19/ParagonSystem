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
import mediaRoutes from "../modules/media/media.routes";
import dashboardRoutes from "../modules/dashboard/dashboard.routes";
import settingsRoutes from "../modules/settings/settings.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/settings", settingsRoutes);
router.use("/users", userRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/applications", applicationRoutes);
router.use("/staff", staffRoutes);
router.use("/editorial-board", editorialBoardRoutes);
router.use("/notifications", notificationRoutes);
router.use("/articles", articlesRoutes);
router.use("/special-issues", specialIssueRoutes);
router.use("/colleges", collegeRoutes);
router.use("/activity-logs", activityLogRoutes);
router.use("/media", mediaRoutes);


export default router;
