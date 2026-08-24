import { Router } from "express";
import { getAdminsHandler, updateAdminHandler } from "./admin.controller.js";

const router = Router();

router.get("/", getAdminsHandler);
router.put("/:id", updateAdminHandler);

export default router;
