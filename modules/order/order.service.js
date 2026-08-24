import { prisma } from "../../config/database.js";
import { Prisma } from "../../generated/prisma/index.js";

// Get all orders for a branch
export async function getOrdersByBranch(branchId, query = {}) {
  const { status, order_type } = query;
  const where = { branch_id: branchId };
  if (status) where.status = status;
  if (order_type) where.order_type = order_type;

  return await prisma.order.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: {
      table: true,
      invoice: true,
    },
  });
}

// Create new order
export async function createOrder(data) {
  const { table_id, status } = data;

  // Use a transaction if a table is assigned, to update table status
  if (table_id && status !== "Paid") {
    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({ data });
      await tx.table.update({
        where: { id: table_id },
        data: { status: "Occupied" },
      });
      return order;
    });
  }

  return await prisma.order.create({
    data,
  });
}

// Update existing order
// If kot_numbers are provided in data, APPEND them to the existing array (don't overwrite)
export async function updateOrder(id, data) {
  const { kot_numbers, ...rest } = data;

  if (kot_numbers && kot_numbers.length > 0) {
    // Fetch the current order to get existing kot_numbers
    const current = await prisma.order.findUnique({ where: { id }, select: { kot_numbers: true } });
    const merged = [...(current?.kot_numbers || []), ...kot_numbers];

    return await prisma.order.update({
      where: { id },
      data: { ...rest, kot_numbers: merged },
    });
  }

  return await prisma.order.update({
    where: { id },
    data: rest,
  });
}

// Update KDS status of a KOT or specific Item
export async function updateKDSStatus(id, { kotNumber, itemId, itemIds, status }) {
  const current = await prisma.order.findUnique({
    where: { id },
    select: { running_order: true }
  });

  if (!current || !current.running_order) {
    throw new Error("Order or running_order not found");
  }

  const running_order = current.running_order;

  // If itemIds (array) is provided, update multiple items
  if (itemIds && Array.isArray(itemIds)) {
    for (const item of running_order) {
      if (itemIds.includes(item.id)) {
        item.status = status;
      }
    }
  }
  // If itemId is provided, update only that specific item
  else if (itemId) {
    for (const item of running_order) {
      if (item.id === itemId) {
        item.status = status;
      }
    }
  } 
  // Else if kotNumber is provided, update all items belonging to that KOT
  else if (kotNumber) {
    for (const item of running_order) {
      if (item.kot_number === kotNumber) {
        item.status = status;
      }
    }
  }

  return await prisma.order.update({
    where: { id },
    data: { running_order }
  });
}

// Delete order
export async function deleteOrder(id) {
  const order = await prisma.order.findUnique({ where: { id } });

  if (!order) return null;

  if (order?.table_id && order?.status !== "Paid") {
    return await prisma.$transaction(async (tx) => {
      const deletedOrder = await tx.order.delete({ where: { id } });

      // If table is still occupied and this was the active order, free it up
      await tx.table.update({
        where: { id: order.table_id },
        data: { status: "Available", order_data: Prisma.DbNull },
      });
      return deletedOrder;
    });
  }

  return await prisma.order.delete({
    where: { id },
  });
}
