import { prisma } from "../../config/database.js";

/**
 * Fetch all necessary public data for a customer order page.
 */
export async function getCustomerMenuData(tableId) {
  // 1. Fetch Table Info
  const table = await prisma.table.findUnique({
    where: { id: tableId },
    select: { id: true, name: true, status: true, branch_id: true },
  });

  if (!table) throw new Error("Table not found");

  const branchId = table.branch_id;

  // 2. Fetch Branch Info
  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true, name: true, contact: true, address: true, status: true, business_id: true, currency: true },
  });

  if (!branch) throw new Error("Branch not found");

  const businessId = branch.business_id;

  // 3. Fetch Business Info
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { id: true, name: true, phone: true, email: true },
  });

  if (!business) throw new Error("Business not found");

  // 4. Fetch Categories & Menu Items
  const categories = await prisma.menuCategory.findMany({
    where: { branch_id: branchId },
  });

  const menuItems = await prisma.menuItem.findMany({
    where: { branch_id: branchId },
  });

  return {
    business,
    branch,
    table,
    categories,
    menuItems,
  };
}

/**
 * Fetch all active orders for a specific table.
 */
export async function getTableActiveOrders(tableId) {
  const activeOrders = await prisma.order.findMany({
    where: {
      table_id: tableId,
      status: {
        notIn: ["Completed", "Paid", "Cancelled"],
      },
    },
    orderBy: {
      created_at: "desc",
    },
  });

  return activeOrders;
}
