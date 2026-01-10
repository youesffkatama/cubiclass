const express = require('express');
const router = express.Router();

const authRoutes = require('./v1/auth');
const userRoutes = require('./v1/user');
const workspaceRoutes = require('./v1/workspace');
const classRoutes = require('./v1/classes');
const taskRoutes = require('./v1/tasks');
const noteRoutes = require('./v1/notes');
const notificationRoutes = require('./v1/notifications');
const intelligenceRoutes = require('./v1/intelligence');
const analyticsRoutes = require('./v1/analytics');

router.use('/v1/auth', authRoutes);
router.use('/v1/user', userRoutes);
router.use('/v1/workspace', workspaceRoutes);
router.use('/v1/classes', classRoutes);
router.use('/v1/tasks', taskRoutes);
router.use('/v1/notes', noteRoutes);
router.use('/v1/notifications', notificationRoutes);
router.use('/v1/intelligence', intelligenceRoutes);
router.use('/v1/analytics', analyticsRoutes);

module.exports = router;