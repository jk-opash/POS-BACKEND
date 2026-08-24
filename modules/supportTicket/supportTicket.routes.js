import { Router } from "express";
import {
  createSupportTicketHandler,
  getAllSupportTicketsHandler,
  getSupportTicketByIdHandler,
  updateSupportTicketHandler,
  deleteSupportTicketHandler
} from "./supportTicket.controller.js";

const router = Router();

router.post("/", createSupportTicketHandler);
router.get("/", getAllSupportTicketsHandler);
router.get("/:id", getSupportTicketByIdHandler);
router.put("/:id", updateSupportTicketHandler);
router.delete("/:id", deleteSupportTicketHandler);

export default router;
