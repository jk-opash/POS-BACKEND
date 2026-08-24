import express from "express";
import * as orderController from "./order.controller.js";

const router = express.Router();

// GET /api/order - Fetch all orders (supports filtering by branch_id, status, order_type)
router.get("/", orderController.getOrdersHandler);

// POST /api/order - Create a new order
router.post("/", orderController.createOrderHandler);

// PUT /api/order/:id/kds - Update status of items in the KDS (MUST be before /:id)
router.put("/:id/kds", orderController.updateKDSStatusHandler);

// PUT /api/order/:id - Update an existing order (e.g. adding items to running_order)
router.put("/:id", orderController.updateOrderHandler);

// DELETE /api/order/:id - Delete an order and free up the table
router.delete("/:id", orderController.deleteOrderHandler);

export default router;
