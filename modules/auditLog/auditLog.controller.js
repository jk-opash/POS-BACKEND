import { prisma } from "../../config/database.js";

export async function getAuditLogsHandler(req, res) {
  try {
    const { type, severity, startDate, endDate, limit = 50, business_id, branch_id, actor_role } = req.query;
    
    // Default base query
    const where = {};
    
    // Role-based scoping
    if (req.user.role === 'superadmin') {
      if (business_id) where.business_id = business_id;
      if (branch_id) where.branch_id = branch_id;
    } else if (req.user.role === 'admin') {
      // Admin is restricted to their own business
      where.business_id = req.user.businessId;
      if (branch_id) where.branch_id = branch_id;
    } else {
      // Manager/Staff are restricted to their own business and branch
      where.business_id = req.user.businessId;
      where.branch_id = req.user.branchId;
    }

    // Optional filters
    if (type) where.type = type;
    if (actor_role) where.actor_role = actor_role;
    if (severity) where.severity = severity;
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at.gte = new Date(startDate);
      if (endDate) where.created_at.lte = new Date(endDate);
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: parseInt(limit, 10),
      include: {
        business: {
          select: { name: true }
        }
      }
    });

    res.json({ data: logs });
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    res.status(500).json({ error: "Failed to fetch audit logs" });
  }
}
