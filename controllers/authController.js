const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { User, Notification, ActivityLog } = require("../models");
const logger = require("../services/logger");
const CONFIG = require("../config");

const RegisterSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

async function verifyPassword(password, hash) {
  return await bcrypt.compare(password, hash);
}

function generateAccessToken(userId) {
  return jwt.sign({ userId: userId, type: "access" }, CONFIG.JWT_SECRET, {
    expiresIn: CONFIG.JWT_EXPIRE || "1h",
  });
}

function generateRefreshToken(userId) {
  return jwt.sign(
    { userId: userId, type: "refresh" },
    CONFIG.JWT_REFRESH_SECRET,
    { expiresIn: CONFIG.JWT_REFRESH_EXPIRE || "7d" },
  );
}

exports.register = async (req, res) => {
  logger.info("Register request received:", {
    email: req.body.email,
    username: req.body.username,
  });

  try {
    const { username, email, password, profile } = req.body;

    const validatedData = RegisterSchema.parse({ username, email, password });

    const existingUser = await User.findOne({
      $or: [
        { email: validatedData.email.toLowerCase() },
        { username: validatedData.username },
      ],
    });

    if (existingUser) {
      logger.warn("User already exists");
      return res.status(400).json({
        error: { message: "User with this email or username already exists" },
      });
    }

    const passwordHash = await hashPassword(validatedData.password);
    logger.info("Password hashed");

    const user = await User.create({
      username: validatedData.username,
      email: validatedData.email.toLowerCase(),
      passwordHash: passwordHash,
      profile: {
        firstName: profile?.firstName || validatedData.username,
        lastName: profile?.lastName || "",
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(validatedData.username)}&background=00ed64&color=001e2b`,
      },
      dna: {
        learningStyle: "Visual",
        weaknesses: [],
        strengths: [],
        xp: 0,
        level: 1,
        rank: "Novice",
        badges: [],
        streakDays: 0,
        lastActiveDate: new Date(),
      },
      settings: {
        theme: "dark",
        aiModel: "mistralai/mistral-7b-instruct:free",
        notifications: true,
      },
      subscription: {
        plan: "free",
      },
      lastLogin: new Date(),
    });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    const refreshTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    user.refreshToken = refreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    await user.save();

    logger.info("User created:", user._id);

    await Notification.create({
      userId: user._id,
      type: "success",
      title: "Welcome to Scholar.AI!",
      message:
        "Get started by uploading your first PDF or exploring the AI Tutor.",
      read: false,
    });

    await ActivityLog.create({
      userId: user._id,
      type: "login",
      description: "Account created and first login",
      xpGained: 0,
    });

    logger.info("Sending success response");

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.profile.avatar,
          dna: user.dna,
          settings: user.settings,
          profile: user.profile,
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: refreshToken,
        },
      },
    });
  } catch (error) {
    logger.error("Registration error:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({
          error: { message: "Validation failed", details: error.errors },
        });
    }
    res.status(500).json({
      error: {
        message: "Registration failed",
      },
    });
  }
};

exports.login = async (req, res) => {
  logger.info("Login request received:", { email: req.body.email });

  try {
    const { email, password } = LoginSchema.parse(req.body);

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      logger.warn("User not found");
      return res.status(401).json({
        error: { message: "Invalid email or password" },
      });
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      logger.warn("Invalid password");
      return res.status(401).json({
        error: { message: "Invalid email or password" },
      });
    }

    logger.info("Password verified");

    const newRefreshToken = generateRefreshToken(user._id);
    const refreshTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiry = refreshTokenExpiry;
    user.lastLogin = new Date();

    const today = new Date().setHours(0, 0, 0, 0);
    const lastActive = user.dna.lastActiveDate
      ? new Date(user.dna.lastActiveDate).setHours(0, 0, 0, 0)
      : 0;
    const daysDiff = Math.floor((today - lastActive) / (1000 * 60 * 60 * 24));

    if (daysDiff === 1) {
      user.dna.streakDays += 1;
    } else if (daysDiff > 1) {
      user.dna.streakDays = 1;
    }

    user.dna.lastActiveDate = new Date();
    await user.save();

    const accessToken = generateAccessToken(user._id);

    logger.info("Login successful");

    await ActivityLog.create({
      userId: user._id,
      type: "login",
      description: "User logged in",
      xpGained: 0,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          avatar: user.profile.avatar,
          dna: user.dna,
          settings: user.settings,
          profile: user.profile,
        },
        tokens: {
          accessToken: accessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    logger.error("Login error:", error);
    if (error instanceof z.ZodError) {
      return res
        .status(400)
        .json({
          error: { message: "Validation failed", details: error.errors },
        });
    }
    res.status(500).json({
      error: { message: "Login failed" },
    });
  }
};

exports.getMe = (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        profile: req.user.profile,
        dna: req.user.dna,
        settings: req.user.settings,
      },
    },
  });
};

exports.forgotPassword = async (req, res) => {
  try {
    const validated = ForgotPasswordSchema.parse(req.body);

    const user = await User.findOne({ email: validated.email });
    if (!user) {
      return res.json({
        success: true,
        message:
          "If an account with that email exists, a password reset link has been sent.",
      });
    }

    const resetToken = jwt.sign(
      { userId: user._id, type: "password_reset" },
      CONFIG.JWT_SECRET,
      { expiresIn: "1h" },
    );

    // This part would be moved to an email service
    // For now, we'll just log it
    logger.info(`Password reset token for ${validated.email}: ${resetToken}`);

    res.json({
      success: true,
      message:
        "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (error) {
    logger.error("Forgot password error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: { message: "Validation error", details: error.errors },
      });
    }
    res.status(500).json({ error: { message: "Request failed" } });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      error: { message: "Refresh token required" },
    });
  }

  try {
    // Verify the refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, CONFIG.JWT_REFRESH_SECRET);
    } catch {
      return res.status(403).json({
        error: { message: "Invalid refresh token" },
      });
    }

    // Find user by ID
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(403).json({
        error: { message: "User not found" },
      });
    }

    // Check if the refresh token matches what's stored in DB
    if (
      user.refreshToken !== refreshToken ||
      user.refreshTokenExpiry < Date.now()
    ) {
      return res.status(403).json({
        error: { message: "Invalid or expired refresh token" },
      });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);
    const newRefreshTokenExpiry = Date.now() + 7 * 24 * 60 * 60 * 1000;

    // Update user's refresh token in DB
    user.refreshToken = newRefreshToken;
    user.refreshTokenExpiry = newRefreshTokenExpiry;
    await user.save();

    res.json({
      success: true,
      data: {
        tokens: {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken,
        },
      },
    });
  } catch (error) {
    logger.error("Token refresh error:", error);
    res.status(500).json({
      error: { message: "Token refresh failed" },
    });
  }
};

exports.logout = async (req, res) => {
  try {
    // Clear the refresh token from the database
    if (req.user) {
      req.user.refreshToken = null;
      req.user.refreshTokenExpiry = null;
      await req.user.save();
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({
      error: { message: "Logout failed" },
    });
  }
};
