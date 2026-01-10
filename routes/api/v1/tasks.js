const express = require("express");
const router = express.Router();
const {
  createTask,
  getTasks,
  updateTask,
  deleteTask,
} = require("../../../controllers/taskController");
const { authenticateToken } = require("../../../middleware/auth");

router.post("/", authenticateToken, createTask);
router.get("/", authenticateToken, getTasks);
router.patch("/:id", authenticateToken, updateTask);
router.delete("/:id", authenticateToken, deleteTask);

module.exports = router;
