import { prisma } from "../../config/database.js";

export const fetchNotifications = async (userId, branchId, businessId, role, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;

  // Extract role string correctly
  let roleStr = typeof role === 'object' ? (role?.name || "") : (role || "");
  roleStr = roleStr.toLowerCase().replace(/\s+/g, '_');

  // Build the OR query based on user context
  const OR = [];
  
  if (userId) OR.push({ targetUser: userId });
  if (branchId) {
    if (roleStr === "waiter") {
      OR.push({ targetBranch: branchId });
    } else if (roleStr === "manager") {
      OR.push({ targetBranch: branchId, type: { not: "KDS_READY" } });
    } else if (roleStr === "admin" || roleStr === "superadmin" || roleStr === "owner") {
      OR.push({ targetBranch: branchId });
    } else {
      OR.push({ targetBranch: branchId, type: { notIn: ["KDS_READY", "QR_ORDER_CREATED"] } });
    }
  }
  if (businessId && (roleStr === "admin" || roleStr === "superadmin" || roleStr === "owner")) {
    OR.push({ targetBusiness: businessId });
  }
  if (roleStr === "superadmin") {
    OR.push({ targetAdmin: true });
  }

  // If no targets can be matched, return empty
  if (OR.length === 0) {
    return { notifications: [], total: 0, unreadCount: 0 };
  }

  const whereClause = { OR };

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take: Number(limit),
    }),
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({ where: { ...whereClause, isRead: false } }),
  ]);

  return { notifications, total, unreadCount };
};

export const markAsRead = async (id) => {
  return await prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
};

export const markAllAsRead = async (userId, branchId, businessId, role) => {
  let roleStr = typeof role === 'object' ? (role?.name || "") : (role || "");
  roleStr = roleStr.toLowerCase().replace(/\s+/g, '_');

  const OR = [];
  if (userId) OR.push({ targetUser: userId });
  if (branchId) {
    if (roleStr === "waiter") {
      OR.push({ targetBranch: branchId });
    } else if (roleStr === "manager") {
      OR.push({ targetBranch: branchId, type: { not: "KDS_READY" } });
    } else if (roleStr === "admin" || roleStr === "superadmin" || roleStr === "owner") {
      OR.push({ targetBranch: branchId });
    } else {
      OR.push({ targetBranch: branchId, type: { notIn: ["KDS_READY", "QR_ORDER_CREATED"] } });
    }
  }
  if (businessId && (roleStr === "admin" || roleStr === "superadmin" || roleStr === "owner")) {
    OR.push({ targetBusiness: businessId });
  }
  if (roleStr === "superadmin") {
    OR.push({ targetAdmin: true });
  }

  if (OR.length === 0) return { count: 0 };

  return await prisma.notification.updateMany({
    where: { OR, isRead: false },
    data: { isRead: true },
  });
};

export const createNotification = async (data) => {
  return await prisma.notification.create({
    data,
  });
};

export const deleteNotification = async (id) => {
  return await prisma.notification.delete({
    where: { id },
  });
};

