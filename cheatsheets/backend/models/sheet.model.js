const mongoose = require('mongoose');

const SheetSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['bash', 'dev', 'sys', 'net', 'web', 'other'],
    default: 'other'
  },
  format: {
    type: String,
    required: [true, 'Format is required'],
    enum: ['md', 'txt', 'pdf', 'html', 'csv', 'json', 'xml', 'yaml', 'yml', 'ini', 'conf'],
    default: 'md'
  },
  path: {
    type: String,
    required: [true, 'File path is required']
  },
  icon: {
    type: String,
    default: 'fa-file'
  },
  tags: {
    type: [String],
    default: []
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Sheet', SheetSchema); 