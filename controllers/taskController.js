const { Task } = require("../models");
const { awardXP } = require("../services/gamificationService");
const logger = require("../services/logger");

exports.createTask = async (req, res) => {
  try {
    const { title, description, dueDate, classId, priority } = req.body;

    const task = await Task.create({
      userId: req.user._id,
      title,
      description,
      dueDate,
      classId,
      priority,
    });

    res.status(201).json({ success: true, data: task });
  } catch (error) {
    logger.error("Create task error:", error);
    res.status(500).json({ error: { message: "Failed to create task" } });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { completed, classId } = req.query;

    const query = { userId: req.user._id };
    if (completed !== undefined) query.completed = completed === "true";
    if (classId) query.classId = classId;

    const tasks = await Task.find(query)
      .sort({ dueDate: 1, createdAt: -1 })
      .populate("classId", "name color")
      .lean();

    res.json({ success: true, data: { tasks } });
  } catch (error) {
    logger.error("Failed to fetch tasks", error);
    res.status(500).json({ error: { message: "Failed to fetch tasks" } });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const updates = req.body;

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      updates,
      { new: true, runValidators: true },
    );

    if (!task) {
      return res.status(404).json({ error: { message: "Task not found" } });
    }

    if (updates.completed && !task.completedAt) {
      task.completedAt = new Date();
      await task.save();
      await awardXP(req.user._id, 10, "Completed a task");
    }

    res.json({ success: true, data: task });
  } catch (error) {
    logger.error("Failed to update task", error);
    res.status(500).json({ error: { message: "Failed to update task" } });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const result = await Task.deleteOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: { message: "Task not found" } });
    }

    res.json({ success: true, data: { message: "Task deleted" } });
  } catch (error) {
    logger.error("Failed to delete task", error);
    res.status(500).json({ error: { message: "Failed to delete task" } });
  }
};
