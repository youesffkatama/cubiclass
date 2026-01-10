const express = require("express");
const router = express.Router();
const {
  streamChat,
  getConversations,
  getConversationById,
  deleteConversation,
  generateFlashcards,
  generateQuiz,
} = require("../../../controllers/intelligenceController");
const { authenticateToken } = require("../../../middleware/auth");

router.post("/chat/stream", authenticateToken, streamChat);
router.get("/chat/conversations", authenticateToken, getConversations);
router.get("/chat/conversations/:id", authenticateToken, getConversationById);
router.delete("/chat/conversations/:id", authenticateToken, deleteConversation);
router.post("/flashcards", authenticateToken, generateFlashcards);
router.post("/quiz", authenticateToken, generateQuiz);

module.exports = router;
