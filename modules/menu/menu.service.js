import { prisma } from "../../config/database.js";
import crypto from "crypto";

// --- CATEGORIES ---
export async function getCategoriesByBranch(branchId) {
  return await prisma.menuCategory.findMany({
    where: { branch_id: branchId },
    // orderBy: { sort_order: "asc" },
  });
}

export async function createCategory(data) {
  let processedSubCategories = data.sub_categories ?? [];
  if (Array.isArray(processedSubCategories)) {
    processedSubCategories = processedSubCategories.map((sub) => ({
      ...sub,
      id: sub.id || crypto.randomUUID(),
    }));
  }

  return await prisma.menuCategory.create({
    data: {
      branch_id: data.branch_id,
      name: data.name,
      sort_order: data.sort_order ?? 0,
      is_active: data.is_active ?? true,
      sub_categories: processedSubCategories,
    },
  });
}

export async function updateCategory(id, data) {
  const updateData = { ...data };
  if (updateData.sub_categories && Array.isArray(updateData.sub_categories)) {
    updateData.sub_categories = updateData.sub_categories.map((sub) => ({
      ...sub,
      id: sub.id || crypto.randomUUID(),
    }));
  }

  return await prisma.menuCategory.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteCategory(id) {
  return await prisma.menuCategory.delete({
    where: { id },
  });
}

// --- MENU ITEMS ---
export async function getMenuItemsByBranch(branchId) {
  return await prisma.menuItem.findMany({
    where: { branch_id: branchId },
    include: {
      category: true,
    },
  });
}

export async function getMenuItemById(id) {
  return await prisma.menuItem.findUnique({
    where: { id },
    include: {
      category: true,
    },
  });
}

export async function createMenuItem(data) {
  return await prisma.menuItem.create({
    data: {
      branch_id: data.branch_id,
      category_id: data.category_id || null,
      sub_category: data.sub_category || null,
      name: data.name,
      food_type: data.food_type || "veg",
      image_url: data.image_url || null,
      base_price: data.base_price,
      spice_level_enabled: data.spice_level_enabled ?? false,
      variants: data.variants ?? [],
      addon_categories: data.addon_categories ?? [],
      status: data.status || "Active",
    },
    include: {
      category: true,
    },
  });
}

export async function updateMenuItem(id, data) {
  const updateData = {};

  if (data.sub_category !== undefined)
    updateData.sub_category = data.sub_category;
  if (data.name !== undefined) updateData.name = data.name;
  if (data.food_type !== undefined) updateData.food_type = data.food_type;
  if (data.image_url !== undefined) updateData.image_url = data.image_url;
  if (data.base_price !== undefined) updateData.base_price = data.base_price;
  if (data.spice_level_enabled !== undefined)
    updateData.spice_level_enabled = data.spice_level_enabled;
  if (data.variants !== undefined) updateData.variants = data.variants;
  if (data.addon_categories !== undefined)
    updateData.addon_categories = data.addon_categories;
  if (data.status !== undefined) updateData.status = data.status;

  if (data.category_id !== undefined) {
    if (data.category_id) {
      updateData.category = { connect: { id: data.category_id } };
    } else {
      updateData.category = { disconnect: true };
    }
  }

  return await prisma.menuItem.update({
    where: { id },
    data: updateData,
    include: {
      category: true,
    },
  });
}

export async function deleteMenuItem(id) {
  return await prisma.menuItem.delete({
    where: { id },
  });
}
