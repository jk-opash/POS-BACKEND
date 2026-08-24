import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database.js";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://localhost:8081",
        "http://127.0.0.1:8081",
        "https://request-flashback-liquid.ngrok-free.dev",
      ],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      credentials: true,
    },
  });

  // Authentication Middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error: No token provided"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      return next(new Error("Authentication error: Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const branchId = socket.handshake.query.branchId;
    const branchIds = socket.handshake.query.branchIds; // Allow multiple branches

    if (branchId) {
      socket.join(`branch_${branchId}`);
      console.log(`Socket ${socket.id} joined room: branch_${branchId}`);
      if (socket.user && socket.user.role) {
        let roleStr =
          typeof socket.user.role === "object"
            ? socket.user.role.name
            : socket.user.role;
        if (roleStr) {
          roleStr = roleStr.toLowerCase().replace(/\s+/g, "_");
          socket.join(`branch_${branchId}_${roleStr}`);
          console.log(
            `Socket ${socket.id} joined role room: branch_${branchId}_${roleStr}`,
          );
        }
      }
    } else if (branchIds) {
      const ids = branchIds.split(",");
      ids.forEach((id) => {
        socket.join(`branch_${id}`);
        console.log(`Socket ${socket.id} joined room: branch_${id}`);
      });
    } else {
      console.log(`Socket ${socket.id} connected but no branchId provided`);
    }

    // Join user-specific room for session management
    if (socket.user && socket.user.id) {
      const userRoom = `user_${socket.user.id}`;
      socket.join(userRoom);

      // Join Admin and Business rooms for notifications
      if (socket.user.role === "superadmin") {
        socket.join("admin");
        console.log(`[Socket] User ${socket.user.id} joined room: admin`);
      }

      const bizId = socket.user.business_id || socket.user.businessId;
      if (bizId) {
        socket.join(`business_${bizId}`);
        console.log(
          `[Socket] User ${socket.user.id} joined room: business_${bizId}`,
        );
      }

      // Concurrent Login Check for Team Members
      let roleStr =
        typeof socket.user.role === "object"
          ? socket.user.role.name
          : socket.user.role;
      const isTeamMember = roleStr !== "admin" && roleStr !== "superadmin";

      console.log(
        `[Socket] User joined: ${userRoom} | Role:`,
        roleStr,
        `| isTeamMember: ${isTeamMember}`,
      );

      if (isTeamMember) {
        setTimeout(async () => {
          try {
            const userSockets = await io.in(userRoom).fetchSockets();
            console.log(
              `[Socket] Sockets in ${userRoom}: ${userSockets.length}`,
            );
            if (userSockets.length > 1) {
              console.log(
                `[Socket] Session conflict detected for team_member ${socket.user.id}`,
              );
              io.to(userRoom).emit("session_conflict", {
                message:
                  "This account is logged in on multiple devices. Enter your PIN to continue.",
              });
            }
          } catch (e) {
            console.error("Error checking socket conflicts:", e);
          }
        }, 500); // slight delay to allow room join to propagate
      }
    }

    // Resolve Conflict Handler
    socket.on("resolve_conflict", async ({ pin }) => {
      try {
        if (!socket.user) return;
        const roleStr =
          typeof socket.user.role === "object"
            ? socket.user.role.name
            : socket.user.role;
        const isTeamMember = roleStr !== "admin" && roleStr !== "superadmin";
        if (!isTeamMember) return;

        const userId = socket.user.id;
        const userRoom = `user_${userId}`;

        const teamMember = await prisma.teamMember.findUnique({
          where: { id: userId },
        });

        if (teamMember && teamMember.pin === pin) {
          // Success! This socket wins.
          socket.emit("session_conflict_resolved");

          // Expire all OTHER sockets
          socket.broadcast.to(userRoom).emit("session_expired", {
            message: "Session expired. You were logged in from another device.",
          });

          // Disconnect all OTHER sockets
          const allUserSockets = await io.in(userRoom).fetchSockets();
          for (const s of allUserSockets) {
            if (s.id !== socket.id) {
              s.disconnect(true);
            }
          }
        } else {
          socket.emit("session_conflict_failed", { error: "Invalid PIN" });
        }
      } catch (err) {
        console.error("Error resolving conflict", err);
        socket.emit("session_conflict_failed", {
          error: "Internal server error",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket ${socket.id} disconnected`);
    });
  });
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io is not initialized!");
  }
  return io;
};

export const emitToBranch = (branchId, event, data) => {
  if (io && branchId) {
    io.to(`branch_${branchId}`).emit(event, data);
  }
};

export const sendNotification = async (notificationData) => {
  try {
    // 1. Save to DB
    const savedNotif = await prisma.notification.create({
      data: notificationData,
    });

    // 2. Emit to correct Socket room if io is initialized
    if (io) {
      const rooms = [];
      if (savedNotif.targetBranch) {
        if (savedNotif.type === "KDS_READY") {
          rooms.push(`branch_${savedNotif.targetBranch}_waiter`);
          rooms.push(`branch_${savedNotif.targetBranch}_admin`);
          rooms.push(`branch_${savedNotif.targetBranch}_manager`);
          rooms.push(`branch_${savedNotif.targetBranch}_owner`);
          rooms.push(`branch_${savedNotif.targetBranch}_superadmin`);
        } else if (savedNotif.type === "QR_ORDER_CREATED") {
          rooms.push(`branch_${savedNotif.targetBranch}_waiter`);
          rooms.push(`branch_${savedNotif.targetBranch}_manager`);
          rooms.push(`branch_${savedNotif.targetBranch}_admin`);
          rooms.push(`branch_${savedNotif.targetBranch}_owner`);
          rooms.push(`branch_${savedNotif.targetBranch}_superadmin`);
        } else {
          rooms.push(`branch_${savedNotif.targetBranch}`);
        }
      }
      if (savedNotif.targetUser) rooms.push(`user_${savedNotif.targetUser}`);
      if (savedNotif.targetBusiness)
        rooms.push(`business_${savedNotif.targetBusiness}`);
      if (savedNotif.targetAdmin) rooms.push(`admin`);

      if (rooms.length > 0) {
        io.to(rooms).emit("new_notification", savedNotif);
      }
    }
    return savedNotif;
  } catch (error) {
    console.error("Error sending notification:", error);
    throw error;
  }
};
