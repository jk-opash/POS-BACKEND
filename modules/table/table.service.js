import { prisma } from "../../config/database.js";

// Get all tables for a zone
export async function getTablesByZone(zoneId) {
  return await prisma.table.findMany({
    where: { zone_id: zoneId },
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: { status: "Pending" }
      }
    }
  });
}

// Get all tables for a branch
export async function getTablesByBranch(branchId) {
  return await prisma.table.findMany({
    where: { branch_id: branchId },
    orderBy: { name: "asc" },
    include: {
      orders: {
        where: { status: "Pending" }
      }
    }
  });
}

// Create new table
export async function createTable(data) {
  return await prisma.table.create({
    data,
  });
}

// Update existing table
export async function updateTable(id, data) {
  return await prisma.table.update({
    where: { id },
    data,
  });
}

// Delete table
export async function deleteTable(id) {
  return await prisma.table.delete({
    where: { id },
  });
}
