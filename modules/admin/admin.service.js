import { prisma } from "../../config/database.js";

export async function getAllAdmins() {
  const admins = await prisma.admin.findMany({
    include: {
      businesses: true,
    },
    orderBy: {
      created_at: "asc",
    },
  });

  return admins.map((admin) => ({
    id: admin.id,
    name: admin.name,
    email: admin.email,
    phone: admin.phone || "N/A",
    is_active: admin.is_active,
    created_at: admin.created_at,
    businesses_count: admin.businesses.length,
    businesses: admin.businesses.map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      is_active: b.is_active,
    })),
  }));
}

export async function updateAdmin(id, data) {
  const { name, email, phone, is_active } = data;

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (is_active !== undefined) {
    updateData.is_active = is_active;
    
    // Also cascade the status to all businesses owned by this admin
    await prisma.business.updateMany({
      where: { admin_id: id },
      data: {
        is_active: is_active,
        status: is_active ? "active" : "suspended"
      }
    });
  }

  return await prisma.admin.update({
    where: { id },
    data: updateData,
  });
}
