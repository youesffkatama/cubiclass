const { Note } = require('../models');
const logger = require('../services/logger');

exports.createNote = async (req, res) => {
    try {
        const { title, content, tags, classId, nodeId } = req.body;

        const note = await Note.create({
            userId: req.user._id,
            title,
            content,
            tags,
            classId,
            nodeId
        });

        res.status(201).json({ success: true, data: note });

    } catch (error) {
        logger.error('Create note error:', error);
        res.status(500).json({ error: { message: 'Failed to create note' } });
    }
};

exports.getNotes = async (req, res) => {
    try {
        const { classId, nodeId, search } = req.query;

        const query = { userId: req.user._id };
        if (classId) query.classId = classId;
        if (nodeId) query.nodeId = nodeId;
        if (search) {
            query.$or = [
                { title: new RegExp(search, 'i') },
                { content: new RegExp(search, 'i') }
            ];
        }

        const notes = await Note.find(query)
            .sort({ updatedAt: -1 })
            .lean();

        res.json({ success: true, data: { notes } });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to fetch notes' } });
    }
};

exports.updateNote = async (req, res) => {
    try {
        const updates = { ...req.body, updatedAt: Date.now() };

        const note = await Note.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            updates,
            { new: true, runValidators: true }
        );

        if (!note) {
            return res.status(404).json({ error: { message: 'Note not found' } });
        }

        res.json({ success: true, data: note });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to update note' } });
    }
};

exports.deleteNote = async (req, res) => {
    try {
        const result = await Note.deleteOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: { message: 'Note not found' } });
        }

        res.json({ success: true, data: { message: 'Note deleted' } });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to delete note' } });
    }
};
