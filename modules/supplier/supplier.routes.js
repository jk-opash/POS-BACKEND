import { Router } from "express";
import { SupplierController } from "./supplier.controller.js";

const router = Router();

router.post("/", SupplierController.create);
router.get("/", SupplierController.getAll);
router.get("/:id", SupplierController.getOne);
router.put("/:id", SupplierController.update);
router.delete("/:id", SupplierController.remove);

export default router;
