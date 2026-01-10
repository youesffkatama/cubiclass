const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  forgotPassword,
  refreshToken,
  logout,
} = require("../../../controllers/authController");
const { authenticateToken } = require("../../../middleware/auth");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh", refreshToken); // Add refresh token endpoint
router.get("/me", authenticateToken, getMe);
router.post("/logout", authenticateToken, logout); // Add logout endpoint
router.post("/forgot-password", forgotPassword);

module.exports = router;
