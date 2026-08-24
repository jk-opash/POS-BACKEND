import * as supportTicketService from "./supportTicket.service.js";
import { sendNotification } from "../socket/socket.service.js";

export async function createSupportTicketHandler(req, res) {
  try {
    const data = req.body;
    // If it's a business making the request, set business_id automatically
    // Assuming req.user exists and has a business_id if they are a team member / admin
    if (req.user && (req.user.business_id || req.user.businessId)) {
       data.business_id = req.user.business_id || req.user.businessId;
    }
    if (req.user && (req.user.branch_id || req.user.branchId)) {
       data.branch_id = req.user.branch_id || req.user.branchId;
    }

    const isOwner = req.user && ['owner', 'admin', 'superadmin'].includes(req.user.role);
    if (!data.business_id && !isOwner) {
      return res.status(400).json({ error: "business_id is required" });
    }
    if (!data.branch_id && !isOwner) {
      return res.status(400).json({ error: "branch_id is required" });
    }
    if (!data.subject) {
      return res.status(400).json({ error: "subject is required" });
    }

    const newTicket = await supportTicketService.createSupportTicket(data);
    
    // Notify Superadmins about the new ticket
    sendNotification({
      title: "New Support Ticket",
      message: `New Urgent Ticket #${newTicket.ticket_number || newTicket.id.substring(0,6)} from Branch ${newTicket.branch_id}.`,
      type: "SUPPORT_UPDATE",
      referenceId: newTicket.id,
      targetBusiness: null,
      targetBranch: null,
      targetUser: null,
      targetAdmin: true // Send to admins
    }).catch(err => console.error("Notification error:", err));

    res.status(201).json({ message: "Support ticket created successfully", data: newTicket });
  } catch (err) {
    console.error("Error in createSupportTicketHandler:", err);
    res.status(500).json({ error: "Failed to create support ticket" });
  }
}

export async function getAllSupportTicketsHandler(req, res) {
  try {
    const filters = {
      status: req.query.status,
      priority: req.query.priority,
      search: req.query.search,
      business_id: req.query.business_id,
      branch_id: req.query.branch_id
    };

    // If it's a business user, restrict to their own tickets
    if (req.user && (req.user.business_id || req.user.businessId)) {
      filters.business_id = req.user.business_id || req.user.businessId;
    }
    if (req.user && (req.user.branch_id || req.user.branchId)) {
      filters.branch_id = req.user.branch_id || req.user.branchId;
    }

    const tickets = await supportTicketService.getAllSupportTickets(filters);
    res.json(tickets);
  } catch (err) {
    console.error("Error in getAllSupportTicketsHandler:", err);
    res.status(500).json({ error: "Failed to fetch support tickets" });
  }
}

export async function getSupportTicketByIdHandler(req, res) {
  try {
    const { id } = req.params;
    const ticket = await supportTicketService.getSupportTicketById(id);
    
    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    // Security check: restrict to business_id if not superadmin
    const userBizId = req.user && (req.user.business_id || req.user.businessId);
    if (userBizId && ticket.business_id !== userBizId) {
       return res.status(403).json({ error: "Forbidden: You cannot access this ticket." });
    }

    res.json(ticket);
  } catch (err) {
    console.error("Error in getSupportTicketByIdHandler:", err);
    res.status(500).json({ error: "Failed to fetch support ticket" });
  }
}

export async function updateSupportTicketHandler(req, res) {
  try {
    const { id } = req.params;
    const data = req.body;
    
    // Check if ticket exists and user has access
    const ticket = await supportTicketService.getSupportTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    const userBizId = req.user && (req.user.business_id || req.user.businessId);
    if (userBizId && ticket.business_id !== userBizId) {
       return res.status(403).json({ error: "Forbidden: You cannot update this ticket." });
    }

    const updatedTicket = await supportTicketService.updateSupportTicket(id, data);
    
    // Notify the restaurant owner/branch about the ticket update
    if (updatedTicket.business_id) {
      sendNotification({
        title: "Support Ticket Updated",
        message: `Platform Support has updated your ticket #${updatedTicket.ticket_number || updatedTicket.id.substring(0,6)}`,
        type: "SUPPORT_UPDATE",
        referenceId: updatedTicket.id,
        targetBusiness: updatedTicket.business_id,
        targetBranch: updatedTicket.branch_id
      }).catch(err => console.error("Notification error:", err));
    }

    res.json({ message: "Support ticket updated successfully", data: updatedTicket });
  } catch (err) {
    console.error("Error in updateSupportTicketHandler:", err);
    res.status(500).json({ error: "Failed to update support ticket" });
  }
}

export async function deleteSupportTicketHandler(req, res) {
  try {
    const { id } = req.params;
    
    const ticket = await supportTicketService.getSupportTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: "Support ticket not found" });
    }

    const userBizId = req.user && (req.user.business_id || req.user.businessId);
    if (userBizId && ticket.business_id !== userBizId) {
       return res.status(403).json({ error: "Forbidden: You cannot delete this ticket." });
    }

    await supportTicketService.deleteSupportTicket(id);
    res.json({ message: "Support ticket deleted successfully" });
  } catch (err) {
    console.error("Error in deleteSupportTicketHandler:", err);
    res.status(500).json({ error: "Failed to delete support ticket" });
  }
}
