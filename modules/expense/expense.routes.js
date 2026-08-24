import { Router } from "express";
import { getExpensesHandler, createExpenseHandler } from "./expense.controller.js";

const router = Router();

// GET /api/expense
router.get("/", getExpensesHandler);

// POST /api/expense
router.post("/", createExpenseHandler);

export default router;
