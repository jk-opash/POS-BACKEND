import * as invoiceService from "./invoice.service.js";
import { emitToBranch } from "../socket/socket.service.js";
import { prisma } from "../../config/database.js";

// GET /api/invoice
export async function getInvoicesHandler(req, res) {
  try {
    const { branch_id } = req.query;
    if (!branch_id) {
      return res.status(400).json({ error: "branch_id is required" });
    }
    const invoices = await invoiceService.getInvoicesByBranch(branch_id);
    res.json({ data: invoices });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ error: "Failed to fetch invoices" });
  }
}

// POST /api/invoice
export async function createInvoiceHandler(req, res) {
  try {
    const invoice = await invoiceService.createInvoice(req.body);
    
    // Fetch the order to get the table_id
    const order = await prisma.order.findUnique({ where: { id: req.body.order_id } });
    if (order && order.table_id) {
      emitToBranch(invoice.branch_id, "tableStatusChanged", { table_id: order.table_id, status: "Available", branchId: invoice.branch_id });
    }
    
    // We should also emit orderUpdated so KDS and other tablets know it's paid
    if (order) {
      emitToBranch(invoice.branch_id, "orderUpdated", order);
    }
    
    res.status(201).json({ data: invoice });
  } catch (error) {
    console.error("Error creating invoice:", error);
    res.status(500).json({ error: "Failed to create invoice" });
  }
}
