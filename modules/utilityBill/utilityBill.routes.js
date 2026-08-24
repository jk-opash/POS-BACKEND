import express from "express";
import { createUtilityBill, getUtilityBills } from "./utilityBill.controller.js";

const router = express.Router();

router.post("/", createUtilityBill);
router.get("/", getUtilityBills);

export default router;
