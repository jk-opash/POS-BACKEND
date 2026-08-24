import * as teamMemberService from "./teamMember.service.js";
import { emitToBranch, sendNotification } from "../socket/socket.service.js";

// GET /api/team-member
export async function getTeamMembersHandler(req, res) {
  try {
    const { businessId } = req.query;
    const teamMembers = await teamMemberService.getAllTeamMembers(businessId);
    res.json({ data: teamMembers });
  } catch (error) {
    console.error("Error fetching team members:", error);
    res.status(500).json({ error: "Failed to fetch team members" });
  }
}

// GET /api/team-member/:id
export async function getTeamMemberByIdHandler(req, res) {
  try {
    const { id } = req.params;
    const teamMember = await teamMemberService.getTeamMemberById(id);
    if (!teamMember) {
      return res.status(404).json({ error: "Team member not found" });
    }
    res.json({ data: teamMember });
  } catch (error) {
    console.error("Error fetching team member:", error);
    res.status(500).json({ error: "Failed to fetch team member" });
  }
}

// POST /api/team-member
export async function createTeamMemberHandler(req, res) {
  try {
    const teamMember = await teamMemberService.createTeamMember(req.body);
    if (teamMember?.branch_id) {
      emitToBranch(teamMember.branch_id, "teamMemberChanged", { id: teamMember.id });
    }
    if (teamMember?.business_id) {
      emitToBranch(teamMember.business_id, "teamMemberChanged", { id: teamMember.id });
    }
    res.status(201).json({ data: teamMember });
  } catch (error) {
    console.error("Error creating team member:", error);
    res.status(500).json({ error: "Failed to create team member" });
  }
}

// PUT /api/team-member/:id
export async function updateTeamMemberHandler(req, res) {
  try {
    const { id } = req.params;
    const teamMember = await teamMemberService.updateTeamMember(id, req.body);
    if (teamMember?.branch_id) {
      emitToBranch(teamMember.branch_id, "teamMemberChanged", { id: teamMember.id });
    }
    if (teamMember?.business_id) {
      emitToBranch(teamMember.business_id, "teamMemberChanged", { id: teamMember.id });
    }
    
    // Notify about role changes
    if (req.body.role) {
      sendNotification({
        title: "Permissions Updated",
        message: `Security: Permissions for staff member '${teamMember.first_name} ${teamMember.last_name}' were updated to ${teamMember.role}.`,
        type: "SYSTEM_ALERT",
        referenceId: teamMember.id,
        targetBusiness: teamMember.business_id,
        targetBranch: teamMember.branch_id,
        targetUser: teamMember.id
      }).catch(err => console.error("Notification error:", err));
    }

    res.json({ data: teamMember });
  } catch (error) {
    console.error("Error updating team member:", error);
    res.status(500).json({ error: "Failed to update team member" });
  }
}

// DELETE /api/team-member/:id
export async function deleteTeamMemberHandler(req, res) {
  try {
    const { id } = req.params;
    const teamMember = await teamMemberService.getTeamMemberById(id);
    await teamMemberService.deleteTeamMember(id);
    if (teamMember?.branch_id) {
      emitToBranch(teamMember.branch_id, "teamMemberChanged", { id });
    }
    if (teamMember?.business_id) {
      emitToBranch(teamMember.business_id, "teamMemberChanged", { id });
    }
    res.json({ message: "Team member deleted successfully" });
  } catch (error) {
    console.error("Error deleting team member:", error);
    res.status(500).json({ error: "Failed to delete team member" });
  }
}

export async function resetTeamMemberPasswordHandler(req, res) {
  try {
    const { id } = req.params;
    const { newPassword: customPassword } = req.body;
    const newPassword = await teamMemberService.resetTeamMemberPassword(id, customPassword);
    res.json({ message: "Password reset successfully", newPassword });
  } catch (error) {
    console.error("Error resetting team member password:", error);
    res.status(500).json({ error: error.message || "Failed to reset password" });
  }
}

export async function resetTeamMemberPinHandler(req, res) {
  try {
    const { id } = req.params;
    const { newPin: customPin } = req.body;
    const newPin = await teamMemberService.resetTeamMemberPin(id, customPin);
    res.json({ message: "PIN reset successfully", newPin });
  } catch (error) {
    console.error("Error resetting team member PIN:", error);
    res.status(500).json({ error: error.message || "Failed to reset PIN" });
  }
}
