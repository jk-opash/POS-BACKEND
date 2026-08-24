import { SupplierService } from "./supplier.service.js";

export const SupplierController = {
  // Create supplier
  create: async (req, res) => {
    try {
      const supplier = await SupplierService.createSupplier(req.body);
      res.status(201).json({ success: true, data: supplier });
    } catch (error) {
      console.error("Error creating supplier:", error);
      res.status(500).json({ success: false, error: "Failed to create supplier" });
    }
  },

  // Get suppliers
  getAll: async (req, res) => {
    try {
      const { business_id, status } = req.query;
      
      if (!business_id) {
        return res.status(400).json({ success: false, error: "business_id is required" });
      }

      const filters = {};
      if (status && status !== "all") {
        filters.status = status;
      }

      const suppliers = await SupplierService.getSuppliers(business_id, filters);
      res.status(200).json({ success: true, data: suppliers });
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      res.status(500).json({ success: false, error: "Failed to fetch suppliers" });
    }
  },

  // Get single supplier
  getOne: async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.getSupplierById(id);
      
      if (!supplier) {
        return res.status(404).json({ success: false, error: "Supplier not found" });
      }

      res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      console.error("Error fetching supplier:", error);
      res.status(500).json({ success: false, error: "Failed to fetch supplier" });
    }
  },

  // Update supplier
  update: async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await SupplierService.updateSupplier(id, req.body);
      res.status(200).json({ success: true, data: supplier });
    } catch (error) {
      console.error("Error updating supplier:", error);
      res.status(500).json({ success: false, error: "Failed to update supplier" });
    }
  },

  // Delete supplier (Archive)
  remove: async (req, res) => {
    try {
      const { id } = req.params;
      await SupplierService.deleteSupplier(id);
      res.status(200).json({ success: true, message: "Supplier archived successfully" });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      res.status(500).json({ success: false, error: "Failed to delete supplier" });
    }
  },
};
