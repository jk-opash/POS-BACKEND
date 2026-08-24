import * as inventoryService from "./inventory.service.js";
import { emitToBranch, sendNotification } from "../socket/socket.service.js";

// ==========================================
// INVENTORY ITEM CONTROLLERS
// ==========================================

/**
 * Get all inventory items for a branch.
 * GET /api/inventory/items/branch/:branchId
 */
export async function getItemsByBranch(req, res) {
  try {
    const { branchId } = req.params;
    if (!branchId) {
      return res
        .status(400)
        .json({ success: false, error: "branchId is required" });
    }
    const items = await inventoryService.getItemsByBranch(branchId);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    console.error("Error in getItemsByBranch:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get a single inventory item by ID.
 * GET /api/inventory/items/:id
 */
export async function getItem(req, res) {
  try {
    const { id } = req.params;
    const item = await inventoryService.getItemById(id);
    if (!item) {
      return res.status(404).json({ success: false, error: "Item not found" });
    }
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error in getItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Create a new inventory item for a branch.
 * POST /api/inventory/items
 */
export async function createItem(req, res) {
  try {
    const { branch_id, name, sku } = req.body;
    if (!branch_id || !name || !sku) {
      return res.status(400).json({
        success: false,
        error: "branch_id, name, and sku are required",
      });
    }
    const item = await inventoryService.createItem(req.body);
    emitToBranch(item.branch_id, "inventoryChanged", { type: "item_created" });
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error("Error in createItem:", error);
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "An item with this SKU already exists for this branch",
      });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Update an inventory item's master data.
 * PUT /api/inventory/items/:id
 */
export async function updateItem(req, res) {
  try {
    const { id } = req.params;
    const item = await inventoryService.updateItem(id, req.body);
    emitToBranch(item.branch_id, "inventoryChanged", { type: "item_updated" });
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    console.error("Error in updateItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Soft-delete an inventory item (is_active = false).
 * DELETE /api/inventory/items/:id
 */
export async function deleteItem(req, res) {
  try {
    const { id } = req.params;
    const item = await inventoryService.deleteItem(id);
    if (item && item.branch_id) {
      emitToBranch(item.branch_id, "inventoryChanged", { type: "item_deleted" });
    }
    return res
      .status(200)
      .json({ success: true, message: "Inventory item deactivated" });
  } catch (error) {
    console.error("Error in deleteItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ==========================================
// STOCK ADJUSTMENT CONTROLLER
// ==========================================

/**
 * Adjust stock for an item.
 * POST /api/inventory/stock/adjust
 * Body: { item_id, quantity_change, movement_type, reason, performed_by?, reference_id? }
 */
export async function adjustStock(req, res) {
  try {
    const { item_id, quantity_change } = req.body;
    if (!item_id || quantity_change === undefined) {
      return res.status(400).json({
        success: false,
        error: "item_id and quantity_change are required",
      });
    }
    const result = await inventoryService.adjustStock(req.body);
    // Find the branch id from the item to emit
    const item = await inventoryService.getItemById(req.body.item_id);
    if (item && item.branch_id) {
      emitToBranch(item.branch_id, "inventoryChanged", { type: "stock_adjusted" });

      // Low Stock Warning for Branch Managers
      if (Number(item.in_stock) <= Number(item.reorder_level)) {
         sendNotification({
           title: "Low Stock Warning",
           message: `Low Stock Warning: '${item.name}' is at or below the minimum stock level (${item.in_stock} ${item.unit} left).`,
           type: "INVENTORY_ALERT",
           referenceId: item.id,
           targetBranch: item.branch_id
         }).catch(err => console.error("Notification error:", err));
      }
    }
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error("Error in adjustStock:", error);
    if (error.message === "Item not found") {
      return res.status(404).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: error.message });
  }
}

// ==========================================
// LEDGER CONTROLLERS
// ==========================================

/**
 * Get movement ledger for a branch.
 * Optionally filter by item: ?itemId=<uuid>
 * GET /api/inventory/ledger/branch/:branchId
 */
export async function getLedgerByBranch(req, res) {
  try {
    const { branchId } = req.params;
    const { itemId } = req.query;
    const ledger = await inventoryService.getLedgerByBranch(branchId, itemId);
    return res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    console.error("Error in getLedgerByBranch:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * Get full movement ledger for one item.
 * GET /api/inventory/ledger/item/:itemId
 */
export async function getLedgerByItem(req, res) {
  try {
    const { itemId } = req.params;
    const ledger = await inventoryService.getLedgerByItem(itemId);
    return res.status(200).json({ success: true, data: ledger });
  } catch (error) {
    console.error("Error in getLedgerByItem:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
