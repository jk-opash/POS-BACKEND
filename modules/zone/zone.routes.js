import express from "express";
import * as zoneController from "./zone.controller.js";

const router = express.Router();

router.get("/", zoneController.getZonesHandler);
router.post("/", zoneController.createZoneHandler);
router.put("/:id", zoneController.updateZoneHandler);
router.delete("/:id", zoneController.deleteZoneHandler);

export default router;
