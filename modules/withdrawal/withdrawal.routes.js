import express from "express";
import { createWithdrawal, getWithdrawals } from "./withdrawal.controller.js";

const router = express.Router();

router.post("/", createWithdrawal);
router.get("/", getWithdrawals);

export default router;
