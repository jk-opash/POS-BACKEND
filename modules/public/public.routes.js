import { Router } from "express";
import * as publicController from "./public.controller.js";

const router = Router();

// ==========================================
// PUBLIC ROUTES (No Authentication Required)
// ==========================================

// Get customer menu data
router.get("/menu", publicController.getCustomerMenuData);

// Create order
router.post("/order", publicController.createPublicOrder);

// Update order KOT
router.put("/order/:id/kot", publicController.updatePublicOrderKOT);

// Get active orders for a table
router.get("/order/:tableId/active", publicController.getTableActiveOrders);

export default router;
