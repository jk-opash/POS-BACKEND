// Force nodemon restart
import "dotenv/config.js";
import express, { json, urlencoded } from "express";
import cors from "cors";
import { connectDB } from "./config/database.js";

import http from "http";
import { initSocket } from "./modules/socket/socket.service.js";
import { initCronJobs } from "./modules/cron/cron.service.js";

const app = express();
const port = process.env.PORT || 5000;
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Initialize Cron Jobs
initCronJobs();

// Middleware
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://localhost:8081",
      "http://127.0.0.1:8081",
      "https://request-flashback-liquid.ngrok-free.dev",
      /\.vercel\.app$/, // Allow all Vercel domains
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(json());
app.use(urlencoded({ extended: true }));

// Connect to Database
connectDB();

// Import Routes
import authRoutes from "./modules/auth/auth.routes.js";
import businessRoutes from "./modules/business/business.routes.js";
import subscriptionRoutes from "./modules/subscription/subscription.routes.js";
import uploadRoutes from "./modules/upload/upload.routes.js";
import adminRoutes from "./modules/admin/admin.routes.js";
import branchRoutes from "./modules/branch/branch.routes.js";
import teamMemberRoutes from "./modules/teamMember/teamMember.routes.js";
import zoneRoutes from "./modules/zone/zone.routes.js";
import tableRoutes from "./modules/table/table.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import orderRoutes from "./modules/order/order.routes.js";
import invoiceRoutes from "./modules/invoice/invoice.routes.js";
import analyticsRoutes from "./modules/analytics/analytics.routes.js";
import expenseRoutes from "./modules/expense/expense.routes.js";
import auditLogRoutes from "./modules/auditLog/auditLog.routes.js";
import supplierRoutes from "./modules/supplier/supplier.routes.js";
import utilityBillRoutes from "./modules/utilityBill/utilityBill.routes.js";
import withdrawalRoutes from "./modules/withdrawal/withdrawal.routes.js";
import supportTicketRoutes from "./modules/supportTicket/supportTicket.routes.js";
import notificationRoutes from "./modules/notification/notification.routes.js";
import publicRoutes from "./modules/public/public.routes.js";

import { authenticate } from "./middleware/auth.middleware.js";
import { requireActiveSubscription } from "./middleware/subscription.middleware.js";

// Mount Routes
app.use("/api/public", publicRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/upload", authenticate, requireActiveSubscription, uploadRoutes);
app.use("/api/admin", authenticate, adminRoutes);
app.use("/api/branch", authenticate, requireActiveSubscription, branchRoutes);
app.use("/api/team-member", authenticate, requireActiveSubscription, teamMemberRoutes);
app.use("/api/zone", authenticate, requireActiveSubscription, zoneRoutes);
app.use("/api/table", authenticate, requireActiveSubscription, tableRoutes);
app.use("/api/menu", authenticate, requireActiveSubscription, menuRoutes);
app.use("/api/inventory", authenticate, requireActiveSubscription, inventoryRoutes);
app.use("/api/order", authenticate, requireActiveSubscription, orderRoutes);
app.use("/api/invoice", authenticate, requireActiveSubscription, invoiceRoutes);
app.use("/api/analytics", analyticsRoutes); // Has its own authentication
app.use("/api/expense", authenticate, requireActiveSubscription, expenseRoutes);
app.use("/api/audit-logs", auditLogRoutes); // Has its own authentication
app.use("/api/supplier", authenticate, requireActiveSubscription, supplierRoutes);
app.use("/api/utility-bill", authenticate, requireActiveSubscription, utilityBillRoutes);
app.use("/api/withdrawal", authenticate, requireActiveSubscription, withdrawalRoutes);
app.use("/api/support-ticket", authenticate, supportTicketRoutes);
app.use("/api/notifications", authenticate, notificationRoutes);

// Serve uploads folder statically
app.use("/uploads", express.static("uploads"));

// Basic route
app.get("/", (req, res) => {
  res.send("POS API is running");
});

server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
