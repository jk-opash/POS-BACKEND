import { prisma } from "../../config/database.js";

// Get all zones for a branch
export async function getZonesByBranch(branchId) {
  return await prisma.zone.findMany({
    where: { branch_id: branchId },
    include: { tables: true },
    orderBy: { created_at: "asc" },
  });
}

// Create new zone
export async function createZone(data) {
  return await prisma.zone.create({
    data,
    include: { tables: true },
  });
}

// Update existing zone
export async function updateZone(id, data) {
  return await prisma.zone.update({
    where: { id },
    data,
    include: { tables: true },
  });
}

// Delete zone
export async function deleteZone(id) {
  return await prisma.zone.delete({
    where: { id },
  });
}
