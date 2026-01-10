const { KnowledgeNode, VectorChunk, Conversation } = require("../models");
const logger = require("../services/logger");
const fs = require("fs").promises;
const { pdfQueue } = require("../services/queueService");

exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: { message: "No file uploaded" } });
    }

    const node = await KnowledgeNode.create({
      userId: req.user._id,
      type: "PDF",
      meta: {
        originalName: req.file.originalname,
        filePath: req.file.path,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      status: "QUEUED",
    });

    if (pdfQueue) {
      await pdfQueue.add("process-pdf", {
        nodeId: node._id.toString(),
        filePath: req.file.path,
      });
    }

    logger.info(`📤 File uploaded: ${node._id}`);

    res.status(201).json({
      success: true,
      data: {
        nodeId: node._id,
        fileName: req.file.originalname,
        status: "QUEUED",
      },
    });
  } catch (error) {
    logger.error("Upload error:", error);
    res.status(500).json({ error: { message: "Upload failed" } });
  }
};

exports.getFiles = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const validLimit = Math.min(parseInt(limit) || 20, 100);
    const validPage = Math.max(parseInt(page) || 1, 1);

    const query = { userId: req.user._id };
    if (status) query.status = status;
    if (search) {
      query.$or = [
        { "meta.originalName": new RegExp(search, "i") },
        { tags: new RegExp(search, "i") },
      ];
    }

    const [nodes, count] = await Promise.all([
      KnowledgeNode.find(query)
        .sort({ createdAt: -1 })
        .limit(validLimit)
        .skip((validPage - 1) * validLimit)
        .lean(),
      KnowledgeNode.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        files: nodes,
        pagination: {
          total: count,
          page: validPage,
          pages: Math.ceil(count / validLimit),
        },
      },
    });
  } catch (error) {
    logger.error("Fetch files error:", error);
    res.status(500).json({ error: { message: "Failed to fetch files" } });
  }
};

exports.getFileById = async (req, res) => {
  try {
    const node = await KnowledgeNode.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();

    if (!node) {
      return res.status(404).json({ error: { message: "File not found" } });
    }

    const chunkCount = await VectorChunk.countDocuments({ nodeId: node._id });

    res.json({
      success: true,
      data: { ...node, chunkCount },
    });
  } catch (error) {
    logger.error("Failed to fetch file", error);
    res.status(500).json({ error: { message: "Failed to fetch file" } });
  }
};

exports.getFileStatus = async (req, res) => {
  try {
    const node = await KnowledgeNode.findOne({
      _id: req.params.id,
      userId: req.user._id,
    })
      .select("status processingError meta.pageCount")
      .lean();

    if (!node) {
      return res.status(404).json({ error: { message: "File not found" } });
    }

    let progress = null;
    if (
      (node.status === "PROCESSING" || node.status === "QUEUED") &&
      pdfQueue
    ) {
      const jobs = await pdfQueue.getJobs(["active", "waiting"]);
      const job = jobs.find((j) => j.data.nodeId === req.params.id);
      if (job) progress = await job.progress();
    }

    res.json({
      success: true,
      data: {
        status: node.status,
        progress,
        error: node.processingError,
        pageCount: node.meta?.pageCount,
      },
    });
  } catch (error) {
    logger.error("Failed to check status", error);
    res.status(500).json({ error: { message: "Failed to check status" } });
  }
};

exports.deleteFile = async (req, res) => {
  try {
    const node = await KnowledgeNode.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });

    if (!node) {
      return res.status(404).json({ error: { message: "File not found" } });
    }

    try {
      await fs.unlink(node.meta.filePath);
    } catch (err) {
      logger.warn("File deletion warning:", err);
    }

    await Promise.all([
      VectorChunk.deleteMany({ nodeId: node._id }),
      Conversation.deleteMany({ nodeId: node._id }),
      node.deleteOne(),
    ]);

    res.json({ success: true, data: { message: "File deleted successfully" } });
  } catch (error) {
    logger.error("Failed to delete file", error);
    res.status(500).json({ error: { message: "Failed to delete file" } });
  }
};
