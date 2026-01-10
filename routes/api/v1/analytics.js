const express = require("express");
const router = express.Router();
const {
  getDashboardStats,
  getPerformance,
} = require("../../../controllers/analyticsController");
const { authenticateToken } = require("../../../middleware/auth");

router.get("/dashboard", authenticateToken, getDashboardStats);
router.get("/performance", authenticateToken, getPerformance);

module.exports = router;
