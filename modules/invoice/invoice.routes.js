import express from "express";
import * as invoiceController from "./invoice.controller.js";

const router = express.Router();

// GET /api/invoice - Fetch all invoices (supports filtering by branch_id)
router.get("/", invoiceController.getInvoicesHandler);

// POST /api/invoice - Create a new invoice (and automatically mark Order as Paid)
router.post("/", invoiceController.createInvoiceHandler);

export default router;
