import { prisma } from "../../config/database.js";

function computeStatus(stock, reorderLevel) {
  const s = Number(stock);
  const r = Number(reorderLevel);
  if (s <= 0) return "Out of Stock";
  if (s <= r * 0.5) return "Critical";
  if (s <= r) return "Low";
  return "Normal";
}

// ─────────────────────────────────────────────
// INVENTORY ITEMS  (Isolated Branch Model)
// ─────────────────────────────────────────────

/**
 * Get all inventory items for a specific branch.
 */
export async function getItemsByBranch(branchId) {
  const items = await prisma.inventoryItem.findMany({
    where: { branch_id: branchId, is_active: true },
    orderBy: { name: "asc" },
  });
  return items;
}

/**
 * Get a single inventory item by id.
 */
export async function getItemById(id) {
  return prisma.inventoryItem.findUnique({
    where: { id },
  });
}

/**
 * Create a new inventory item for a branch.
 * Automatically records initial stock in the ledger if > 0.
 */
export async function createItem(data) {
  const {
    branch_id,
    name,
    sku,
    category,
    unit = "pcs",
    price = 0,
    reorder_level = 0,
    is_composite = false,
    ingredients,
    in_stock = 0,
  } = data;

  const stockStatus = computeStatus(in_stock, reorder_level);

  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.create({
      data: {
        branch_id,
        name,
        sku,
        category: category || null,
        unit,
        price,
        reorder_level,
        is_composite,
        ingredients: ingredients ?? null,
        in_stock,
        status: stockStatus,
      },
    });

    await tx.stockLedger.create({
      data: {
        item_id: item.id,
        movement_type: "ITEM_CREATED",
        quantity_change: Number(in_stock) || 0,
        reason: "Item created",
      },
    });

    return item;
  });
}

/**
 * Update an inventory item's master data.
 */
export async function updateItem(id, data) {
  const allowed = [
    "name", "sku", "category", "unit", "price",
    "reorder_level", "is_composite", "ingredients", "is_active",
  ];
  const updateData = {};
  allowed.forEach((k) => {
    if (data[k] !== undefined) updateData[k] = data[k];
  });
  updateData.updated_at = new Date();

  return prisma.inventoryItem.update({
    where: { id },
    data: updateData,
  });
}

/**
 * Soft-delete an inventory item (set is_active = false).
 */
export async function deleteItem(id) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id },
    });

    const deletedItem = await tx.inventoryItem.update({
      where: { id },
      data: { is_active: false, updated_at: new Date(), in_stock: 0 },
    });

    await tx.stockLedger.create({
      data: {
        item_id: id,
        movement_type: "DELETION",
        quantity_change: item ? -Number(item.in_stock) : 0,
        reason: "Item deleted",
      },
    });

    return deletedItem;
  });
}

// ─────────────────────────────────────────────
// STOCK ADJUSTMENTS
// ─────────────────────────────────────────────

/**
 * Adjust stock for a specific item.
 * quantity_change can be positive (add) or negative (deduct).
 * movement_type: ADJUSTMENT | TRANSFER_IN | TRANSFER_OUT | RECEIVED | SALE_DEDUCTION | REFUND_RESTORE
 */
export async function adjustStock(data) {
  const {
    item_id,
    quantity_change,
    movement_type = "ADJUSTMENT",
    reason,
    performed_by,
    reference_id,
  } = data;

  return prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryItem.findUnique({
      where: { id: item_id },
    });

    if (!existing) {
      throw new Error("Item not found");
    }

    const currentStock = Number(existing.in_stock);
    const newStock = currentStock + Number(quantity_change);
    const reorderLevel = Number(existing.reorder_level);
    const newStatus = computeStatus(newStock, reorderLevel);

    const updatedItem = await tx.inventoryItem.update({
      where: { id: item_id },
      data: {
        in_stock: newStock,
        status: newStatus,
        updated_at: new Date(),
      },
    });

    // Write immutable ledger entry
    await tx.stockLedger.create({
      data: {
        item_id,
        movement_type,
        quantity_change,
        reason: reason || null,
        performed_by: performed_by || null,
        reference_id: reference_id || null,
      },
    });

    return { item: updatedItem, new_stock: newStock, status: newStatus };
  });
}

// ─────────────────────────────────────────────
// LEDGER QUERIES
// ─────────────────────────────────────────────

/**
 * Get the stock ledger (movement log) for a specific item.
 */
export async function getLedgerByItem(itemId) {
  return prisma.stockLedger.findMany({
    where: { item_id: itemId },
    include: {
      item: { select: { name: true, sku: true, unit: true, branch_id: true } },
    },
    orderBy: { created_at: "desc" },
    take: 200,
  });
}

/**
 * Get the stock ledger for an entire branch (joining through InventoryItem).
 * Optional query: ?itemId=<uuid> to filter by item.
 */
export async function getLedgerByBranch(branchId, itemId) {
  return prisma.stockLedger.findMany({
    where: {
      item: {
        branch_id: branchId,
      },
      ...(itemId ? { item_id: itemId } : {}),
    },
    include: { item: { select: { name: true, sku: true, unit: true } } },
    orderBy: { created_at: "desc" },
    take: 200,
  });
}
