import { Router } from "express";
import { getAuditLogsHandler } from "./auditLog.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();

router.get("/debug-count", async (req, res) => {
  try {
    const { prisma } = await import("../../config/database.js");
    const count = await prisma.auditLog.count();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/audit-logs
router.get("/", authenticate, getAuditLogsHandler);

export default router;
