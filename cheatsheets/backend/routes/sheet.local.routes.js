const express = require('express');
const router = express.Router();
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Path to local sheets data file
const sheetsFile = path.join(__dirname, '../../data/sheets.json');

// Get all sheets
router.get('/', async (req, res) => {
  try {
    const data = fs.readJsonSync(sheetsFile);
    res.json({
      success: true,
      data: data.sheets || []
    });
  } catch (error) {
    console.error('Error reading sheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sheets'
    });
  }
});

// Get a single sheet by ID
router.get('/:id', async (req, res) => {
  try {
    const data = fs.readJsonSync(sheetsFile);
    const sheet = data.sheets.find(s => s.id === req.params.id);
    
    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }
    
    res.json({
      success: true,
      data: sheet
    });
  } catch (error) {
    console.error('Error reading sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sheet'
    });
  }
});

// Create a new sheet
router.post('/', async (req, res) => {
  try {
    const data = fs.readJsonSync(sheetsFile);
    
    const newSheet = {
      id: uuidv4(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    
    data.sheets.push(newSheet);
    fs.writeJsonSync(sheetsFile, data, { spaces: 2 });
    
    res.status(201).json({
      success: true,
      data: newSheet
    });
  } catch (error) {
    console.error('Error creating sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create sheet'
    });
  }
});

// Update a sheet
router.put('/:id', async (req, res) => {
  try {
    const data = fs.readJsonSync(sheetsFile);
    const sheetIndex = data.sheets.findIndex(s => s.id === req.params.id);
    
    if (sheetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }
    
    const updatedSheet = {
      ...data.sheets[sheetIndex],
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    
    data.sheets[sheetIndex] = updatedSheet;
    fs.writeJsonSync(sheetsFile, data, { spaces: 2 });
    
    res.json({
      success: true,
      data: updatedSheet
    });
  } catch (error) {
    console.error('Error updating sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update sheet'
    });
  }
});

// Delete a sheet
router.delete('/:id', async (req, res) => {
  try {
    const data = fs.readJsonSync(sheetsFile);
    const sheetIndex = data.sheets.findIndex(s => s.id === req.params.id);
    
    if (sheetIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not found'
      });
    }
    
    data.sheets.splice(sheetIndex, 1);
    fs.writeJsonSync(sheetsFile, data, { spaces: 2 });
    
    res.json({
      success: true,
      message: 'Sheet removed'
    });
  } catch (error) {
    console.error('Error deleting sheet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete sheet'
    });
  }
});

module.exports = router; 