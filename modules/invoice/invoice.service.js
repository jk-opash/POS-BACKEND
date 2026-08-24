import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/index.js";

// Get all invoices for a branch
export async function getInvoicesByBranch(branchId) {
  return await prisma.invoice.findMany({
    where: { branch_id: branchId },
    orderBy: { issued_at: "desc" },
    include: {
      order: true,
    },
  });
}

// Create new invoice and settle the order
export async function createInvoice(data) {
  // data contains all required fields from frontend, including invoice_number, order_id, subtotal, etc.
  const { order_id } = data;

  return await prisma.$transaction(async (tx) => {
    // 1. Create the invoice
    const invoice = await tx.invoice.create({ data });

    // Fetch the existing order first
    const existingOrder = await tx.order.findUnique({ where: { id: order_id } });
    const isTakeaway = existingOrder.order_type === "Takeaway";

    // 2. Update the related order.
    // For Takeaway, we keep the existing status so it stays on the KDS until manually closed.
    const order = await tx.order.update({
      where: { id: order_id },
      data: {
        status: isTakeaway ? existingOrder.status : "Paid",
        payment_status: "Paid",
        payment_methods: data.payment_methods,
      },
    });

    // 3. If there's a table assigned to the order, mark it as Available
    if (order.table_id) {
      await tx.table.update({
        where: { id: order.table_id },
        data: { status: "Available", order_data: Prisma.DbNull },
      });
    }

    return invoice;
  });
}
