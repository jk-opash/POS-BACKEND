import { Router } from "express";
import * as inventoryController from "./inventory.controller.js";

const router = Router();

// ==========================================
// INVENTORY ITEM ROUTES (Branch specific)
// ==========================================

// Get all items for a branch
router.get("/items/branch/:branchId", inventoryController.getItemsByBranch);

// Get a single item by id
router.get("/items/:id", inventoryController.getItem);

// Create a new inventory item
router.post("/items", inventoryController.createItem);

// Update item master data
router.put("/items/:id", inventoryController.updateItem);

// Soft-delete an item
router.delete("/items/:id", inventoryController.deleteItem);

// ==========================================
// STOCK ADJUSTMENT ROUTES
// ==========================================

// Adjust stock (add / deduct) for a specific item
// Body: { item_id, quantity_change, movement_type, reason }
router.post("/stock/adjust", inventoryController.adjustStock);

// ==========================================
// LEDGER ROUTES
// ==========================================

// Get movement history for an entire branch
router.get("/ledger/branch/:branchId", inventoryController.getLedgerByBranch);

// Get full movement history for one item
router.get("/ledger/item/:itemId", inventoryController.getLedgerByItem);

export default router;
