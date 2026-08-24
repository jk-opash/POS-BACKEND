import * as tableService from "./table.service.js";
import { emitToBranch, sendNotification } from "../socket/socket.service.js";

// GET /api/table
export async function getTablesHandler(req, res) {
  try {
    const { zone_id, branch_id } = req.query;
    let tables = [];
    if (zone_id) {
      tables = await tableService.getTablesByZone(zone_id);
    } else if (branch_id) {
      tables = await tableService.getTablesByBranch(branch_id);
    } else {
      return res
        .status(400)
        .json({ error: "zone_id or branch_id is required" });
    }

    const mappedTables = tables.map((t) => {
      const { orders, ...rest } = t;
      return {
        ...rest,
        order: orders,
      };
    });

    res.json({ data: mappedTables });
  } catch (error) {
    console.error("Error fetching tables:", error);
    res.status(500).json({ error: "Failed to fetch tables" });
  }
}

// POST /api/table
export async function createTableHandler(req, res) {
  try {
    const table = await tableService.createTable(req.body);
    
    if (table && table.branch_id) {
      emitToBranch(table.branch_id, "tableStatusChanged", { branchId: table.branch_id });
    }
    
    res.status(201).json({ data: table });
  } catch (error) {
    console.error("Error creating table:", error);
    res.status(500).json({ error: "Failed to create table" });
  }
}

// PUT /api/table/:id
export async function updateTableHandler(req, res) {
  try {
    const { id } = req.params;
    const table = await tableService.updateTable(id, req.body);
    
    if (table && table.branch_id) {
      emitToBranch(table.branch_id, "tableStatusChanged", { table_id: table.id, status: table.status, branchId: table.branch_id });
      
      // Table Management alert for Waiters
      if (req.body.status && ["Need Service", "Billing", "Needs Cleaning"].includes(req.body.status)) {
         sendNotification({
           title: "Table Service Requested",
           message: `Service Required: Table '${table.name}' is requesting ${req.body.status}.`,
           type: "TABLE_ALERT",
           referenceId: table.id,
           targetBranch: table.branch_id
         }).catch(err => console.error("Notification error:", err));
      }
    }
    
    res.json({ data: table });
  } catch (error) {
    console.error("Error updating table:", error);
    res.status(500).json({ error: "Failed to update table" });
  }
}

// DELETE /api/table/:id
export async function deleteTableHandler(req, res) {
  try {
    const { id } = req.params;
    
    // Need to get the table first to know the branch_id
    // But since it's hard to get it if delete returns nothing, we just try our best.
    const table = await tableService.deleteTable(id);
    
    if (table && table.branch_id) {
      emitToBranch(table.branch_id, "tableStatusChanged", { branchId: table.branch_id });
    }
    
    res.json({ message: "Table deleted successfully" });
  } catch (error) {
    console.error("Error deleting table:", error);
    res.status(500).json({ error: "Failed to delete table" });
  }
}
