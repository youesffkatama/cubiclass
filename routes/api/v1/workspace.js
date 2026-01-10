const express = require("express");
const router = express.Router();
const {
  uploadFile,
  getFiles,
  getFileById,
  getFileStatus,
  deleteFile,
} = require("../../../controllers/workspaceController");
const { authenticateToken } = require("../../../middleware/auth");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const CONFIG = require("../../../config");

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(CONFIG.UPLOAD_DIR, req.user.id);
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: CONFIG.MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

router.post("/upload", authenticateToken, upload.single("file"), uploadFile);
router.get("/files", authenticateToken, getFiles);
router.get("/files/:id", authenticateToken, getFileById);
router.get("/files/:id/status", authenticateToken, getFileStatus);
router.delete("/files/:id", authenticateToken, deleteFile);

module.exports = router;
