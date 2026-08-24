import { Router } from "express";
import {
  getBusinessesHandler,
  getBusinessByIdHandler,
  updateBusinessHandler,
  getOnboardingRequestsHandler,
  provisionBusinessHandler,
  resetOwnerPasswordHandler,
} from "./business.controller.js";
import {
  authenticateSuperadmin,
  authenticate,
} from "../../middleware/auth.middleware.js";

const router = Router();

// Get all businesses
router.get("/", authenticateSuperadmin, getBusinessesHandler);

// Get all onboarded businesses (Onboarding Requests)
router.get("/onboarding", authenticateSuperadmin, getOnboardingRequestsHandler);

// Provision a new business
router.post("/provision", authenticateSuperadmin, provisionBusinessHandler);

// Get business by ID
router.get("/:id", authenticate, getBusinessByIdHandler);

// Update business by ID
router.put("/:id", authenticate, updateBusinessHandler);

// Reset owner password
router.post("/:id/reset-password", authenticateSuperadmin, resetOwnerPasswordHandler);

export default router;
