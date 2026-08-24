import { Router } from "express";
import * as menuController from "./menu.controller.js";

const router = Router();

// ==========================================
// CATEGORIES ROUTES
// ==========================================

// Get all categories for a branch
router.get("/categories/branch/:branchId", menuController.getCategories);

// Create a new category
router.post("/categories", menuController.createCategory);

// Update a category
router.put("/categories/:id", menuController.updateCategory);

// Delete a category
router.delete("/categories/:id", menuController.deleteCategory);

// ==========================================
// MENU ITEMS ROUTES
// ==========================================

// Get all menu items for a branch
router.get("/items/branch/:branchId", menuController.getMenuItems);

// Create a new menu item
router.post("/items", menuController.createMenuItem);

// Update a menu item
router.put("/items/:id", menuController.updateMenuItem);

// Delete a menu item
router.delete("/items/:id", menuController.deleteMenuItem);

export default router;
