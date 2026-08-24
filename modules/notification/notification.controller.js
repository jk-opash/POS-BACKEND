import * as notificationService from "./notification.service.js";

export const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const { id: userId, branchId, businessId, role } = req.user;

    const result = await notificationService.fetchNotifications(
      userId,
      branchId,
      businessId,
      role,
      page,
      limit
    );

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const notification = await notificationService.markAsRead(id);
    res.status(200).json({ success: true, notification });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const { id: userId, branchId, businessId, role } = req.user;
    const result = await notificationService.markAllAsRead(userId, branchId, businessId, role);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    await notificationService.deleteNotification(id);
    res.status(200).json({ success: true, message: "Notification deleted successfully" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
