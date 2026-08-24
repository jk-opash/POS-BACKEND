import * as menuService from "./menu.service.js";
import { emitToBranch } from "../socket/socket.service.js";

// ==========================================
// MENU CATEGORY CONTROLLERS
// ==========================================

/**
 * Get all categories for a branch
 * GET /api/menu/categories/branch/:branchId
 */
export async function getCategories(req, res) {
  try {
    const { branchId } = req.params;
    if (!branchId) {
      return res
        .status(400)
        .json({ success: false, error: "branchId parameter is required" });
    }
    const categories = await menuService.getCategoriesByBranch(branchId);
    return res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error("Error in getCategories:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new menu category
 * POST /api/menu/categories
 */
export async function createCategory(req, res) {
  try {
    const { branch_id, name } = req.body;
    if (!branch_id || !name) {
      return res
        .status(400)
        .json({ success: false, error: "branch_id and name are required" });
    }
    const category = await menuService.createCategory(req.body);
    emitToBranch(category.branch_id, "menuChanged", { type: "category_created" });
    return res.status(201).json({ success: true, data: category });
  } catch (error) {
    console.error("Error in createCategory:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update an existing menu category
 * PUT /api/menu/categories/:id
 */
export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const category = await menuService.updateCategory(id, req.body);
    emitToBranch(category.branch_id, "menuChanged", { type: "category_updated" });
    return res.status(200).json({ success: true, data: category });
  } catch (error) {
    console.error("Error in updateCategory:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete a menu category
 * DELETE /api/menu/categories/:id
 */
export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const category = await menuService.deleteCategory(id);
    if (category && category.branch_id) {
      emitToBranch(category.branch_id, "menuChanged", { type: "category_deleted" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Category deleted successfully" });
  } catch (error) {
    console.error("Error in deleteCategory:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ==========================================
// MENU ITEM CONTROLLERS
// ==========================================

/**
 * Get all menu items for a branch
 * GET /api/menu/items/branch/:branchId
 */
export async function getMenuItems(req, res) {
  try {
    const { branchId } = req.params;
    if (!branchId) {
      return res
        .status(400)
        .json({ success: false, error: "branchId parameter is required" });
    }
    const items = await menuService.getMenuItemsByBranch(branchId);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error in getMenuItems:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new menu item
 * POST /api/menu/items
 */
export async function createMenuItem(req, res) {
  try {
    const { branch_id, name, base_price } = req.body;
    if (!branch_id || !name || base_price === undefined) {
      return res.status(400).json({
        success: false,
        error: "branch_id, name, and base_price are required fields",
      });
    }
    const item = await menuService.createMenuItem(req.body);
    emitToBranch(item.branch_id, "menuChanged", { type: "item_created" });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error("Error in createMenuItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update an existing menu item
 * PUT /api/menu/items/:id
 */
export async function updateMenuItem(req, res) {
  try {
    const { id } = req.params;
    const item = await menuService.updateMenuItem(id, req.body);
    emitToBranch(item.branch_id, "menuChanged", { type: "item_updated" });
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error in updateMenuItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Delete a menu item
 * DELETE /api/menu/items/:id
 */
export async function deleteMenuItem(req, res) {
  try {
    const { id } = req.params;
    const item = await menuService.deleteMenuItem(id);
    if (item && item.branch_id) {
      emitToBranch(item.branch_id, "menuChanged", { type: "item_deleted" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Menu item deleted successfully" });
  } catch (error) {
    console.error("Error in deleteMenuItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
