const express = require('express');
const router = express.Router();
const { createClass, getClasses, getClassById, updateClass, deleteClass, joinClass } = require('../../../controllers/classController');
const { authenticateToken } = require('../../../middleware/auth');

router.post('/', authenticateToken, createClass);
router.get('/', authenticateToken, getClasses);
router.get('/:id', authenticateToken, getClassById);
router.patch('/:id', authenticateToken, updateClass);
router.delete('/:id', authenticateToken, deleteClass);
router.post('/:id/join', authenticateToken, joinClass);

module.exports = router;
