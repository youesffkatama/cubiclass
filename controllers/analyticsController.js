const { KnowledgeNode, Conversation, ActivityLog } = require("../models");
const logger = require("../services/logger");

exports.getDashboardStats = async (req, res) => {
  try {
    const [totalFiles, totalConversations, recentActivity] = await Promise.all([
      KnowledgeNode.countDocuments({ userId: req.user._id }),
      Conversation.countDocuments({ userId: req.user._id }),
      ActivityLog.find({ userId: req.user._id })
        .sort({ timestamp: -1 })
        .limit(10)
        .lean(),
    ]);

    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);

    const recentActivities = await ActivityLog.countDocuments({
      userId: req.user._id,
      timestamp: { $gte: last30Days },
    });

    const studySessions = await ActivityLog.countDocuments({
      userId: req.user._id,
      type: "study",
      timestamp: { $gte: last30Days },
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
          recentActivities,
          studySessions,
        },
        recentActivity,
      },
    });
  } catch (error) {
    logger.error("Failed to fetch dashboard data", error);
    res
      .status(500)
      .json({ error: { message: "Failed to fetch dashboard data" } });
  }
};

exports.getPerformance = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyStats = await ActivityLog.aggregate([
      {
        $match: {
          userId: req.user._id,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
            type: "$type",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: { "_id.date": 1 },
      },
    ]);

    const performanceData = {};
    dailyStats.forEach((stat) => {
      if (!performanceData[stat._id.date]) {
        performanceData[stat._id.date] = {};
      }
      performanceData[stat._id.date][stat._id.type] = stat.count;
    });

    res.json({ success: true, data: { performance: performanceData } });
  } catch (error) {
    logger.error("Failed to fetch performance data", error);
    res
      .status(500)
      .json({ error: { message: "Failed to fetch performance data" } });
  }
};
