const express = require('express');
const router = express.Router();
const {
  getSheets,
  getSheet,
  createSheet,
  updateSheet,
  deleteSheet,
  uploadFile
} = require('../controllers/sheet.controller');

const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', getSheets);
router.get('/:id', getSheet);

// Protected routes
router.post('/', protect, createSheet);
router.put('/:id', protect, updateSheet);
router.delete('/:id', protect, deleteSheet);
router.post('/upload', protect, upload.single('file'), uploadFile);

module.exports = router; 