const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path to local users data file
const usersFile = path.join(__dirname, '../../data/users.json');

// Get all users
router.get('/', async (req, res) => {
  try {
    const data = fs.readJsonSync(usersFile);
    res.json({
      success: true,
      data: data.users || []
    });
  } catch (error) {
    console.error('Error reading users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve users'
    });
  }
});

// Get current user (placeholder)
router.get('/me', async (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'default',
      name: 'Default User',
      email: 'user@example.com',
      role: 'user'
    }
  });
});

// Register (placeholder)
router.post('/register', async (req, res) => {
  res.json({
    success: true,
    message: 'Registration is disabled in local mode',
    token: 'demo-token'
  });
});

// Login (placeholder)
router.post('/login', async (req, res) => {
  res.json({
    success: true,
    message: 'Authentication is disabled in local mode',
    token: 'demo-token'
  });
});

// Profile (placeholder)
router.get('/profile', async (req, res) => {
  res.json({
    success: true,
    data: {
      id: 'default',
      name: 'Default User',
      email: 'user@example.com',
      role: 'user'
    }
  });
});

module.exports = router; 