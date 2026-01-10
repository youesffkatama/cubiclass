const mongoose = require("mongoose");
const { KnowledgeNode, VectorChunk, Conversation } = require("../models");
const { awardXP } = require("../services/gamificationService");
const logger = require("../services/logger");
const { z } = require("zod");
const {
  sanitizeInput,
  generateEmbedding,
  openai,
} = require("../services/aiService");

const FlashcardSchema = z.object({
  nodeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  count: z.number().int().min(1).max(50).default(10),
});

const QuizSchema = z.object({
  nodeId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  count: z.number().int().min(1).max(20).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
});

const ChatSchema = z.object({
  query: z.string().min(1).max(5000),
  nodeId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  conversationId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/)
    .optional(),
  model: z.string().optional(),
});

exports.streamChat = async (req, res) => {
  try {
    if (!req.body.query) {
      return res.status(400).json({ error: { message: "Query is required" } });
    }

    const validated = ChatSchema.parse(req.body);
    const { query, nodeId, conversationId, model } = validated;

    logger.info("💬 Chat request:", {
      query: query.substring(0, 50),
      nodeId,
      conversationId,
    });

    let node = null;
    if (nodeId) {
      node = await KnowledgeNode.findOne({
        _id: nodeId,
        userId: req.user._id,
        status: "INDEXED",
      });

      if (!node) {
        return res
          .status(404)
          .json({ error: { message: "Document not found or not ready" } });
      }
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let queryEmbedding;
    try {
      queryEmbedding = await generateEmbedding(sanitizeInput(query));
    } catch (embError) {
      logger.error("❌ Embedding generation failed:", embError);
      res.write(
        `data: ${JSON.stringify({ error: "Failed to process query" })}\n\n`,
      );
      res.end();
      return;
    }

    let context = "";
    let citations = [];

    if (nodeId && queryEmbedding) {
      try {
        const relevantChunks = await VectorChunk.aggregate([
          {
            $vectorSearch: {
              index: "vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 100,
              limit: 5,
              filter: { nodeId: new mongoose.Types.ObjectId(nodeId) },
            },
          },
          {
            $project: {
              content: 1,
              location: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ]);

        context = relevantChunks.map((c) => c.content).join("\n\n");
        citations = relevantChunks.map((c) => ({
          chunkId: c._id,
          pageNumber: c.location.pageNumber,
          content: c.content.substring(0, 200),
        }));
      } catch (vectorError) {
        logger.error("❌ Vector search failed:", vectorError);
      }
    }

    const messages = [];

    if (node?.persona?.personalityPrompt) {
      messages.push({
        role: "system",
        content: `You are ${node.persona.generatedName}. ${node.persona.personalityPrompt}\n\nSpeak in a ${node.persona.tone} tone. Base your answers ONLY on the provided context. If the context doesn't contain the answer, say so.`,
      });
    } else {
      messages.push({
        role: "system",
        content: `You are a helpful AI tutor. Answer questions clearly and concisely. If you don't know something, say so.`,
      });
    }

    if (context) {
      messages.push({
        role: "system",
        content: `Context from the document:\n\n${context}`,
      });
    }

    if (conversationId) {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          userId: req.user._id,
        });

        if (conversation) {
          const recentMessages = conversation.messages.slice(-10);
          messages.push(
            ...recentMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          );
        }
      } catch (convError) {
        logger.error("❌ Failed to load conversation:", convError);
      }
    }

    messages.push({ role: "user", content: query });

    logger.info("🤖 Calling OpenRouter API...");

    let stream;
    try {
      stream = await openai.chat.completions.create({
        model:
          model ||
          req.user.settings.aiModel ||
          "mistralai/mistral-7b-instruct:free",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true,
      });
    } catch (apiError) {
      logger.error("❌ OpenRouter API error:", apiError);
      res.write(`data: ${JSON.stringify({
        error: "AI service unavailable. Please try again later.",
        details: apiError.message,
      })}

`);
      res.end();
      return;
    }

    let fullResponse = "";

    try {
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          fullResponse += content;
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }
    } catch (streamError) {
      logger.error("❌ Stream error:", streamError);
    }

    try {
      let conversation;
      if (conversationId) {
        conversation = await Conversation.findOneAndUpdate(
          { _id: conversationId, userId: req.user._id },
          {
            $push: {
              messages: [
                { role: "user", content: query },
                { role: "assistant", content: fullResponse, citations },
              ],
            },
            updatedAt: Date.now(),
          },
          { new: true },
        );
      } else {
        conversation = await Conversation.create({
          userId: req.user._id,
          nodeId: nodeId || null,
          title: query.substring(0, 50),
          messages: [
            { role: "user", content: query },
            { role: "assistant", content: fullResponse, citations },
          ],
        });
      }

      res.write(`data: ${JSON.stringify({
        done: true,
        conversationId: conversation._id,
        citations,
      })}

`);
    } catch (saveError) {
      logger.error("❌ Failed to save conversation:", saveError);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    }

    res.end();

    awardXP(req.user._id, 2, "Asked a question").catch(console.error);
  } catch (error) {
    logger.error("❌ Chat stream error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        error: {
          message: "Chat failed",
          details: error.message,
        },
      });
    } else {
      res.write(`data: ${JSON.stringify({
        error: "An error occurred",
        details: error.message,
      })}

`);
      res.end();
    }
  }
};

exports.getConversations = async (req, res) => {
  try {
    const { nodeId, page = 1, limit = 20 } = req.query;
    const validLimit = Math.min(parseInt(limit) || 20, 100);

    const query = { userId: req.user._id };
    if (nodeId) query.nodeId = nodeId;

    const conversations = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .limit(validLimit)
      .skip((parseInt(page) - 1) * validLimit)
      .select("title nodeId createdAt updatedAt messages")
      .lean();

    conversations.forEach((conv) => {
      conv.messageCount = conv.messages?.length || 0;
      conv.lastMessage = conv.messages?.[conv.messages.length - 1];
      delete conv.messages;
    });

    const count = await Conversation.countDocuments(query);

    res.json({
      success: true,
      data: {
        conversations,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / validLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Failed to fetch conversations", error);
    res
      .status(500)
      .json({ error: { message: "Failed to fetch conversations" } });
  }
};

exports.getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).populate("nodeId", "meta.originalName persona");

    if (!conversation) {
      return res
        .status(404)
        .json({ error: { message: "Conversation not found" } });
    }

    res.json({ success: true, data: conversation });
  } catch (error) {
    logger.error("Failed to fetch conversation", error);
    res
      .status(500)
      .json({ error: { message: "Failed to fetch conversation" } });
  }
};

exports.deleteConversation = async (req, res) => {
  try {
    const result = await Conversation.deleteOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (result.deletedCount === 0) {
      return res
        .status(404)
        .json({ error: { message: "Conversation not found" } });
    }

    res.json({ success: true, data: { message: "Conversation deleted" } });
  } catch (error) {
    logger.error("Failed to delete conversation", error);
    res
      .status(500)
      .json({ error: { message: "Failed to delete conversation" } });
  }
};

exports.generateFlashcards = async (req, res) => {
  try {
    const validated = FlashcardSchema.parse(req.body);
    const { nodeId, count } = validated;

    const node = await KnowledgeNode.findOne({
      _id: nodeId,
      userId: req.user._id,
      status: "INDEXED",
    });

    if (!node) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }

    const chunks = await VectorChunk.aggregate([
      { $match: { nodeId: new mongoose.Types.ObjectId(nodeId) } },
      { $sample: { size: Math.min(count * 2, 20) } },
    ]);

    const context = chunks.map((c) => c.content).join("\n\n");

    const prompt = `Based on this text, generate ${count} flashcards for studying. Each flashcard should have a question and answer.
 
 Text:
 ${context}
 
 Return a JSON array of objects with "question" and "answer" fields. Make questions challenging but answerable from the text. Return ONLY valid JSON array, no markdown.`;

    const response = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 1500,
    });

    const flashcardsText = response.choices[0].message.content;
    const flashcards = JSON.parse(
      flashcardsText.replace(/```json|```/g, "").trim(),
    );

    await awardXP(req.user._id, 10, "Generated flashcards");

    res.json({ success: true, data: { flashcards } });
  } catch (error) {
    logger.error("Flashcard generation error:", error);
    res
      .status(500)
      .json({ error: { message: "Failed to generate flashcards" } });
  }
};

exports.generateQuiz = async (req, res) => {
  try {
    const validated = QuizSchema.parse(req.body);
    const { nodeId, count, difficulty } = validated;

    const node = await KnowledgeNode.findOne({
      _id: nodeId,
      userId: req.user._id,
      status: "INDEXED",
    });

    if (!node) {
      return res.status(404).json({ error: { message: "Document not found" } });
    }

    const chunks = await VectorChunk.aggregate([
      { $match: { nodeId: new mongoose.Types.ObjectId(nodeId) } },
      { $sample: { size: Math.min(count * 3, 30) } },
    ]);

    const context = chunks.map((c) => c.content).join("\n\n");

    const prompt = `Generate ${count} multiple-choice quiz questions based on this text. Difficulty: ${difficulty || "medium"}
 
 Text:
 ${context}
 
 Return a JSON array where each object has:
 - question: string
 - options: array of 4 strings (A, B, C, D)
 - correctAnswer: string (A, B, C, or D)
 - explanation: string
 
 Return ONLY valid JSON array.`;

    const response = await openai.chat.completions.create({
      model: "mistralai/mistral-7b-instruct:free",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const quizText = response.choices[0].message.content;
    const questions = JSON.parse(quizText.replace(/```json|```/g, "").trim());

    await awardXP(req.user._id, 15, "Generated quiz");

    res.json({ success: true, data: { questions } });
  } catch (error) {
    logger.error("Quiz generation error:", error);
    res.status(500).json({ error: { message: "Failed to generate quiz" } });
  }
};
