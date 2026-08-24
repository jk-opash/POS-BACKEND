import { prisma } from "../../config/database.js";

export const SupplierService = {
  // Create a supplier
  createSupplier: async (data) => {
    return await prisma.supplier.create({
      data,
    });
  },

  // Get suppliers by businessId (and optionally status)
  getSuppliers: async (businessId, filters = {}) => {
    const where = { business_id: businessId };
    
    if (filters.status) {
      where.status = filters.status;
    }

    return await prisma.supplier.findMany({
      where,
      orderBy: { created_at: "desc" },
    });
  },

  // Get a single supplier by ID
  getSupplierById: async (id) => {
    return await prisma.supplier.findUnique({
      where: { id },
    });
  },

  // Update a supplier
  updateSupplier: async (id, data) => {
    return await prisma.supplier.update({
      where: { id },
      data,
    });
  },

  // Soft delete a supplier (archive)
  deleteSupplier: async (id) => {
    return await prisma.supplier.update({
      where: { id },
      data: { status: "Archived" },
    });
  },
};
