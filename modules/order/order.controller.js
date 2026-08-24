import * as orderService from "./order.service.js";
import { emitToBranch, sendNotification } from "../socket/socket.service.js";

// GET /api/order
export async function getOrdersHandler(req, res) {
  try {
    const { branch_id, status, order_type } = req.query;
    if (!branch_id) {
      return res.status(400).json({ error: "branch_id is required" });
    }
    const orders = await orderService.getOrdersByBranch(branch_id, {
      status,
      order_type,
    });
    res.json({ data: orders });
  } catch (error) {
    console.error("Error fetching orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
}

// POST /api/order
export async function createOrderHandler(req, res) {
  try {
    const orderData = { ...req.body };
    // If the person creating the order is a staff member, attach their ID
    if (req.user && req.user.id && !orderData.staff_id) {
      // Only set staff_id if the user is an actual TeamMember, to avoid foreign key violations
      if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
        orderData.staff_id = req.user.id;
      }
    }
    const order = await orderService.createOrder(orderData);
    emitToBranch(order.branch_id, "orderCreated", order);
    if (order.table_id && order.status !== "Paid") {
      emitToBranch(order.branch_id, "tableStatusChanged", { table_id: order.table_id, status: "Occupied", branchId: order.branch_id });
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
    console.error("Error creating order:", error);
    res.status(500).json({ error: "Failed to create order" });
  }
}

// PUT /api/order/:id
export async function updateOrderHandler(req, res) {
  try {
    const { id } = req.params;
    const order = await orderService.updateOrder(id, req.body);
    emitToBranch(order.branch_id, "orderUpdated", order);

    // High value void alert (Security Alert for Business Owner)
    if (req.body.status === "Void" && order.total_amount >= 50) {
       sendNotification({
         title: "Security Alert: High-Value Void",
         message: `A high-value order (#${order.order_number || order.id.substring(0,6)}) for $${order.total_amount} was voided.`,
         type: "SECURITY_ALERT",
         referenceId: order.id,
         targetBusiness: order.business_id
       }).catch(err => console.error("Notification error:", err));
    }

    res.json({ data: order });
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ error: "Failed to update order" });
  }
}

// PUT /api/order/:id/kds
export async function updateKDSStatusHandler(req, res) {
  try {
    const { kotNumber, itemId, itemIds, status } = req.body;
    const updatedOrder = await orderService.updateKDSStatus(
      req.params.id,
      { kotNumber, itemId, itemIds, status }
    );
    emitToBranch(updatedOrder.branch_id, "orderUpdated", updatedOrder);

    // KDS Ready alert for Waiters
    if (status === "Ready" || status === "Completed") {
       sendNotification({
         title: "Order Ready",
         message: `Order #${updatedOrder.order_number || updatedOrder.id.substring(0,6)} is ready for pickup/serving.`,
         type: "KDS_READY",
         referenceId: updatedOrder.id,
         targetBranch: updatedOrder.branch_id
       }).catch(err => console.error("Notification error:", err));
    }

    res.json({ message: "KDS status updated successfully", data: updatedOrder });
  } catch (error) {
    console.error("Error updating KDS status:", error);
    res.status(500).json({ error: "Failed to update KDS status" });
  }
}

// DELETE /api/order/:id
export async function deleteOrderHandler(req, res) {
  try {
    const { id } = req.params;
    const deletedOrder = await orderService.deleteOrder(id);
    if (deletedOrder && deletedOrder.branch_id) {
      emitToBranch(deletedOrder.branch_id, "orderDeleted", { id, table_id: deletedOrder.table_id });
      if (deletedOrder.table_id && deletedOrder.status !== "Paid") {
        emitToBranch(deletedOrder.branch_id, "tableStatusChanged", { table_id: deletedOrder.table_id, status: "Available", branchId: deletedOrder.branch_id });
      }
    }
    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
}
