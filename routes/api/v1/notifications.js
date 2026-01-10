const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, deleteNotification } = require('../../../controllers/notificationController');
const { authenticateToken } = require('../../../middleware/auth');

router.get('/', authenticateToken, getNotifications);
router.patch('/:id/read', authenticateToken, markAsRead);
router.delete('/:id', authenticateToken, deleteNotification);

module.exports = router;
