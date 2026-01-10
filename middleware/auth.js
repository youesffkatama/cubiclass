const jwt = require("jsonwebtoken");
const { User } = require("../models");
const CONFIG = require("../config");
const logger = require("../services/logger");

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: { message: "Access token required" },
    });
  }

  try {
    // First, try to verify the token
    let decoded;
    try {
      decoded = jwt.verify(token, CONFIG.JWT_SECRET);
    } catch {
      // If verification fails, try to find user by the token stored in DB
      const user = await User.findOne({ token: token });
      if (!user || !user.token || user.tokenExpiry < Date.now()) {
        return res.status(403).json({
          error: { message: "Invalid or expired token" },
        });
      }
      // Token is valid in DB, attach user to request
      req.user = user;
      return next();
    }

    // If JWT verification succeeded, find user by ID
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({
        error: { message: "User not found" },
      });
    }

    // Check if token is still valid in DB
    if (
      user.token !== token ||
      (user.tokenExpiry && user.tokenExpiry < Date.now())
    ) {
      return res.status(403).json({
        error: { message: "Token has been revoked or expired" },
      });
    }

    req.user = user;
    next();
  } catch (error) {
    logger.error("Authentication error:", error);
    return res.status(500).json({
      error: { message: "Authentication failed" },
    });
  }
};

module.exports = { authenticateToken };
