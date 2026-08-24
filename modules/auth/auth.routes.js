import { Router } from "express";
import { superadminLogin, adminLogin, teamMemberLogin, pinLogin, superadminSettingsUpdate } from "./auth.controller.js";

const router = Router();

// Endpoint for Platform Owners
router.post("/login/superadmin", superadminLogin);

// Endpoint for Restaurant Owners
router.post("/login/admin", adminLogin);

// Endpoint for Web Dashboard Staff
router.post("/login/team", teamMemberLogin);

// Endpoint for POS Terminal Staff (PIN based)
router.post("/login/pin", pinLogin);

// Endpoint for Superadmin settings update
import { authenticateSuperadmin } from "../../middleware/auth.middleware.js";
router.put("/superadmin/settings", authenticateSuperadmin, superadminSettingsUpdate);

export default router;
