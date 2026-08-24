import * as branchService from "./branch.service.js";

// GET /api/branch
export async function getBranchesHandler(req, res) {
  try {
    const { businessId } = req.query;
    const branches = await branchService.getAllBranches(businessId);
    res.json({ data: branches });
  } catch (error) {
    console.error("Error fetching branches:", error);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
}

// GET /api/branch/:id
export async function getBranchByIdHandler(req, res) {
  try {
    const { id } = req.params;
    const branch = await branchService.getBranchById(id);
    if (!branch) {
      return res.status(404).json({ error: "Branch not found" });
    }
    res.json({ data: branch });
  } catch (error) {
    console.error("Error fetching branch:", error);
    res.status(500).json({ error: "Failed to fetch branch" });
  }
}

// POST /api/branch
export async function createBranchHandler(req, res) {
  try {
    const branch = await branchService.createBranch(req.body);
    res.status(201).json({ data: branch });
  } catch (error) {
    console.error("Error creating branch:", error);
    res.status(500).json({ error: "Failed to create branch" });
  }
}

// PUT /api/branch/:id
export async function updateBranchHandler(req, res) {
  try {
    const { id } = req.params;
    const branch = await branchService.updateBranch(id, req.body);
    res.json({ data: branch });
  } catch (error) {
    console.error("Error updating branch:", error);
    res.status(500).json({ error: "Failed to update branch" });
  }
}

// DELETE /api/branch/:id
export async function deleteBranchHandler(req, res) {
  try {
    const { id } = req.params;
    await branchService.deleteBranch(id);
    res.json({ message: "Branch deleted successfully" });
  } catch (error) {
    console.error("Error deleting branch:", error);
    res.status(500).json({ error: "Failed to delete branch" });
  }
}
