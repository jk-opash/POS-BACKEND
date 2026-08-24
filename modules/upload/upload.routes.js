import express from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { uploadFile } from "./upload.controller.js";

const router = express.Router();

// Configure storage for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save files directly to the 'uploads' folder in the root directory
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Generate a unique filename using crypto to avoid collisions
    const uniqueSuffix = crypto.randomBytes(8).toString("hex");
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

// File filter to restrict uploads to specific formats
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only JPG, PNG, and PDF are allowed."), false);
  }
};

// Multer upload instance
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB limit as specified in the frontend UI
  },
  fileFilter,
});

// POST /api/upload - Single file upload expecting a field named 'file'
router.post("/", upload.single("file"), uploadFile);

export default router;
