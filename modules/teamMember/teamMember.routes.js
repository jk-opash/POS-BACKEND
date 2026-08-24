import { Router } from "express";
import {
  getTeamMembersHandler,
  getTeamMemberByIdHandler,
  createTeamMemberHandler,
  updateTeamMemberHandler,
  deleteTeamMemberHandler,
  resetTeamMemberPasswordHandler,
  resetTeamMemberPinHandler,
} from "./teamMember.controller.js";

const router = Router();

// Note: Authentication middleware omitted temporarily, identical to branch.routes.js

// Get all team members
router.get("/", getTeamMembersHandler);

// Get team member by ID
router.get("/:id", getTeamMemberByIdHandler);

// Create a new team member
router.post("/", createTeamMemberHandler);

// Update a team member
router.put("/:id", updateTeamMemberHandler);

// Reset team member password
router.post("/:id/reset-password", resetTeamMemberPasswordHandler);

// Reset team member PIN
router.post("/:id/reset-pin", resetTeamMemberPinHandler);

// Delete a team member
router.delete("/:id", deleteTeamMemberHandler);

export default router;
