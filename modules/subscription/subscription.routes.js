import { Router } from "express";
import {
  getAllSubscriptionsHandler,
  getAllInvoicesHandler,
  addSubscriptionHandler,
  editSubscriptionHandler,
  purchaseAddonsHandler
} from "./subscription.controller.js";
import { authenticateSuperadmin } from "../../middleware/auth.middleware.js";

const router = Router();

// GET all subscription invoices
router.get("/invoices", authenticateSuperadmin, getAllInvoicesHandler);

// GET all subscription plans
router.get("/", authenticateSuperadmin, getAllSubscriptionsHandler);

// POST create a new subscription plan
router.post("/", authenticateSuperadmin, addSubscriptionHandler);

// PUT edit an existing subscription plan
router.put("/:id", authenticateSuperadmin, editSubscriptionHandler);

// POST purchase addons (extra branches/staff)
router.post("/addons", authenticateSuperadmin, purchaseAddonsHandler);

export default router;
