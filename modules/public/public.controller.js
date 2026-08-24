import * as publicService from "./public.service.js";
import * as orderService from "../order/order.service.js";
import { emitToBranch, sendNotification } from "../socket/socket.service.js";
/**
 * GET /api/public/menu?tableId=...&branchId=...&businessId=...
 */
export async function getCustomerMenuData(req, res) {
  try {
    const { tableId } = req.query;

    if (!tableId) {
      return res.status(400).json({
        success: false,
        error: "tableId is required",
      });
    }

    const data = await publicService.getCustomerMenuData(tableId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Error in getCustomerMenuData:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to fetch menu data",
    });
  }
}

/**
 * POST /api/public/order
 */
export async function createPublicOrder(req, res) {
  try {
    const orderData = { ...req.body };
    const order = await orderService.createOrder(orderData);
    
    emitToBranch(order.branch_id, "orderCreated", order);
    if (order.table_id && order.status !== "Paid") {
      emitToBranch(order.branch_id, "tableStatusChanged", { 
        table_id: order.table_id, 
        status: "Occupied", 
        branchId: order.branch_id 
      });
    }

    if (order.order_type === "QR Order") {
      sendNotification({
        title: "New QR Order",
        message: `A new QR Order (#${order.order_number || order.id.substring(0,6)}) has been placed.`,
        type: "QR_ORDER_CREATED",
        referenceId: order.id,
        targetBranch: order.branch_id
      }).catch(err => console.error("Notification error:", err));
    }
    
    res.status(201).json({ data: order });
  } catch (error) {
    console.error("Error creating public order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
}

/**
 * PUT /api/public/order/:id/kot
 */
export async function updatePublicOrderKOT(req, res) {
  try {
    const { id } = req.params;
    const order = await orderService.updateOrder(id, req.body);
    
    emitToBranch(order.branch_id, "orderUpdated", order);
    
    res.json({ data: order });
  } catch (error) {
    console.error("Error updating public order KOT:", error);
    res.status(500).json({ error: "Failed to update order KOT" });
  }
}
