import express from "express";
import { getNotifications, markAsRead, markAllAsRead, deleteNotification } from "./notification.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = express.Router();

// All notification routes require authentication
router.use(authenticate);

router.get("/", getNotifications);
router.patch("/read-all", markAllAsRead);
router.patch("/:id/read", markAsRead);
router.delete("/:id", deleteNotification);

export default router;
