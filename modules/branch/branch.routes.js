import { Router } from "express";
import {
  getBranchesHandler,
  getBranchByIdHandler,
  createBranchHandler,
  updateBranchHandler,
  deleteBranchHandler,
} from "./branch.controller.js";

const router = Router();

// Note: Authentication middleware has been temporarily omitted per the user's plan approval.
// This allows testing the APIs before an appropriate `authenticateAdmin` is available.

// Get all branches
router.get("/", getBranchesHandler);

// Get branch by ID
router.get("/:id", getBranchByIdHandler);

// Create a new branch
router.post("/", createBranchHandler);

// Update a branch
router.put("/:id", updateBranchHandler);

// Delete a branch
router.delete("/:id", deleteBranchHandler);

export default router;
