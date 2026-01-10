const { Class } = require('../models');
const { awardXP } = require('../services/gamificationService');
const logger = require('../services/logger');

function generateInviteCode() {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
}

exports.createClass = async (req, res) => {
    try {
        const { name, description, color } = req.body;

        const classObj = await Class.create({
            userId: req.user._id,
            name,
            description,
            color,
            inviteCode: generateInviteCode(),
            members: [{
                userId: req.user._id,
                role: 'teacher'
            }]
        });

        await awardXP(req.user._id, 25, 'Created a class');

        res.status(201).json({
            success: true,
            data: classObj
        });

    } catch (error) {
        logger.error('Create class error:', error);
        res.status(500).json({ error: { message: 'Failed to create class' } });
    }
};

exports.getClasses = async (req, res) => {
    try {
        const classes = await Class.find({
            $or: [
                { userId: req.user._id },
                { 'members.userId': req.user._id }
            ]
        })
            .sort({ createdAt: -1 })
            .populate('members.userId', 'username profile.avatar')
            .lean();

        res.json({ success: true, data: { classes } });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to fetch classes' } });
    }
};

exports.getClassById = async (req, res) => {
    try {
        const classObj = await Class.findOne({
            _id: req.params.id,
            $or: [
                { userId: req.user._id },
                { 'members.userId': req.user._id }
            ]
        })
            .populate('members.userId', 'username profile.avatar')
            .lean();

        if (!classObj) {
            return res.status(404).json({ error: { message: 'Class not found' } });
        }

        res.json({ success: true, data: classObj });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to fetch class' } });
    }
};

exports.updateClass = async (req, res) => {
    try {
        const { name, description, color } = req.body;

        const classObj = await Class.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { name, description, color },
            { new: true, runValidators: true }
        );

        if (!classObj) {
            return res.status(404).json({ error: { message: 'Class not found' } });
        }

        res.json({ success: true, data: classObj });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to update class' } });
    }
};

exports.deleteClass = async (req, res) => {
    try {
        const result = await Class.deleteOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: { message: 'Class not found' } });
        }

        res.json({ success: true, data: { message: 'Class deleted' } });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to delete class' } });
    }
};

exports.joinClass = async (req, res) => {
    try {
        const { inviteCode } = req.body;

        const classObj = await Class.findOne({
            _id: req.params.id,
            inviteCode
        });

        if (!classObj) {
            return res.status(404).json({ error: { message: 'Invalid invite code' } });
        }

        const alreadyMember = classObj.members.some(m => m.userId.equals(req.user._id));
        if (alreadyMember) {
            return res.status(400).json({ error: { message: 'Already a member' } });
        }

        classObj.members.push({
            userId: req.user._id,
            role: 'student'
        });

        await classObj.save();

        res.json({ success: true, data: classObj });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to join class' } });
    }
};
