const {
  KnowledgeNode,
  Conversation,
  Task,
  ActivityLog,
} = require("../models"); // Added missing models
const logger = require("../services/logger");

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, bio } = req.body;
    req.user.profile = { ...req.user.profile, firstName, lastName, bio };
    await req.user.save();
    res.json({ success: true, data: { profile: req.user.profile } });
  } catch (error) {
    logger.error("Update profile error:", error);
    res.status(500).json({ error: { message: "Update failed" } });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const { theme, aiModel, notifications } = req.body;
    req.user.settings = { ...req.user.settings, theme, aiModel, notifications };
    await req.user.save();
    res.json({ success: true, data: { settings: req.user.settings } });
  } catch (error) {
    logger.error("Update settings error:", error);
    res.status(500).json({ error: { message: "Update failed" } });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [totalFiles, totalConversations, totalTasks, completedTasks] =
      await Promise.all([
        KnowledgeNode.countDocuments({ userId: req.user._id }),
        Conversation.countDocuments({ userId: req.user._id }),
        Task.countDocuments({ userId: req.user._id }),
        Task.countDocuments({ userId: req.user._id, completed: true }),
      ]);

    const last7Days = new Date();
    last7Days.setDate(last7Days.getDate() - 7);

    const recentActivity = await ActivityLog.countDocuments({
      userId: req.user._id,
      timestamp: { $gte: last7Days },
    });

    res.json({
      success: true,
      data: {
        user: {
          level: req.user.dna.level,
          xp: req.user.dna.xp,
          rank: req.user.dna.rank,
          streakDays: req.user.dna.streakDays,
        },
        stats: {
          totalFiles,
          totalConversations,
          totalTasks,
          completedTasks,
          recentActivity,
          completionRate:
            totalTasks > 0
              ? Math.round((completedTasks / totalTasks) * 100)
              : 0,
        },
      },
    });
  } catch (error) {
    logger.error("Get stats error:", error);
    res.status(500).json({ error: { message: "Failed to fetch stats" } });
  }
};
