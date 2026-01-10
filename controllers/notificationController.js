const { Notification } = require('../models');
const logger = require('../services/logger');

exports.getNotifications = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const notifications = await Notification.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(Math.min(parseInt(limit), 100))
            .lean();

        const unreadCount = await Notification.countDocuments({
            userId: req.user._id,
            read: false
        });

        res.json({
            success: true,
            data: { notifications, unreadCount }
        });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to fetch notifications' } });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, userId: req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ error: { message: 'Notification not found' } });
        }

        res.json({ success: true, data: notification });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to mark as read' } });
    }
};

exports.deleteNotification = async (req, res) => {
    try {
        const result = await Notification.deleteOne({
            _id: req.params.id,
            userId: req.user._id
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: { message: 'Notification not found' } });
        }

        res.json({ success: true, data: { message: 'Notification deleted' } });

    } catch (error) {
        res.status(500).json({ error: { message: 'Failed to delete notification' } });
    }
};
