import { prisma } from "../../config/database.js";

// Get all branches (optionally filter by business_id)
export async function getAllBranches(businessId) {
  const query = businessId ? { where: { business_id: businessId } } : {};
  return await prisma.branch.findMany({
    ...query,
    orderBy: { created_at: "asc" },
  });
}

// Get branch by ID
export async function getBranchById(id) {
  return await prisma.branch.findUnique({
    where: { id },
    include: {
      teamMembers: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          email: true,
          role: true,
          status: true,
        }
      }
    }
  });
}

// Create new branch
export async function createBranch(data) {
  return await prisma.branch.create({
    data,
  });
}

// Update existing branch
export async function updateBranch(id, data) {
  return await prisma.branch.update({
    where: { id },
    data,
  });
}

// Delete branch
export async function deleteBranch(id) {
  return await prisma.branch.delete({
    where: { id },
  });
}
