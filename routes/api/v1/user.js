const express = require("express");
const router = express.Router();
const {
  updateProfile,
  updateSettings,
  getStats,
} = require("../../../controllers/userController");
const { authenticateToken } = require("../../../middleware/auth");

router.patch("/profile", authenticateToken, updateProfile);
router.patch("/settings", authenticateToken, updateSettings);
router.get("/stats", authenticateToken, getStats);

module.exports = router;
