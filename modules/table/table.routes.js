import express from "express";
import * as tableController from "./table.controller.js";

const router = express.Router();

router.get("/", tableController.getTablesHandler);
router.post("/", tableController.createTableHandler);
router.put("/:id", tableController.updateTableHandler);
router.delete("/:id", tableController.deleteTableHandler);

export default router;
