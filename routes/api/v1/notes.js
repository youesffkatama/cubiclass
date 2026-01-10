const express = require('express');
const router = express.Router();
const { createNote, getNotes, updateNote, deleteNote } = require('../../../controllers/noteController');
const { authenticateToken } = require('../../../middleware/auth');

router.post('/', authenticateToken, createNote);
router.get('/', authenticateToken, getNotes);
router.patch('/:id', authenticateToken, updateNote);
router.delete('/:id', authenticateToken, deleteNote);

module.exports = router;
