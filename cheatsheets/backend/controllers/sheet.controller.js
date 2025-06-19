const Sheet = require('../models/sheet.model');
const fs = require('fs-extra');
const path = require('path');

// @desc    Get all cheatsheets
// @route   GET /api/sheets
// @access  Public
exports.getSheets = async (req, res) => {
  try {
    const { category, tag, search } = req.query;
    let query = {};

    // Apply filter for category
    if (category && category !== 'all') {
      query.category = category;
    }

    // Apply filter for tags
    if (tag) {
      query.tags = { $in: [tag] };
    }

    // Apply search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const sheets = await Sheet.find(query).sort({ name: 1 });
    
    // If no sheets in DB but files exist in the sheets directory,
    // create entries for them
    if (sheets.length === 0) {
      const sheetsDir = process.env.FILE_STORAGE_PATH || '../data/sheets';
      const fullSheetsDir = path.join(__dirname, '..', sheetsDir);
      
      if (fs.existsSync(fullSheetsDir)) {
        const files = fs.readdirSync(fullSheetsDir);
        
        for (const file of files) {
          // Skip hidden files and directories
          if (file.startsWith('.') || fs.statSync(path.join(fullSheetsDir, file)).isDirectory()) {
            continue;
          }
          
          const fileExt = path.extname(file).substring(1);
          const fileName = path.basename(file, path.extname(file));
          
          // Skip if format is not supported
          const supportedFormats = ['md', 'txt', 'pdf', 'html', 'csv', 'json', 'xml', 'yaml', 'yml', 'ini', 'conf'];
          if (!supportedFormats.includes(fileExt)) {
            continue;
          }
          
          // Determine a sensible category based on the file extension or content
          let category = 'other';
          if (fileExt === 'md' || fileExt === 'txt') {
            if (fileName.includes('bash') || fileName.includes('shell') || fileName.includes('command')) {
              category = 'bash';
            } else if (fileName.includes('dev') || fileName.includes('code') || fileName.includes('program')) {
              category = 'dev';
            } else if (fileName.includes('sys') || fileName.includes('system')) {
              category = 'sys';
            } else if (fileName.includes('net') || fileName.includes('network') || fileName.includes('http')) {
              category = 'net';
            }
          } else if (fileExt === 'html') {
            category = 'web';
          }
          
          // Create tags based on filename
          const tags = fileName.split('-').filter(tag => tag.length > 2);
          
          // Create a new sheet entry
          await Sheet.create({
            name: fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            category,
            format: fileExt,
            path: `${sheetsDir}/${file}`,
            icon: getIconForFormat(fileExt),
            tags,
            isPublic: true
          });
        }
        
        // Fetch sheets again after creating entries
        const initialSheets = await Sheet.find(query).sort({ name: 1 });
        
        res.status(200).json({
          success: true,
          count: initialSheets.length,
          data: initialSheets
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      count: sheets.length,
      data: sheets
    });
  } catch (error) {
    console.error('Error in getSheets:', error);
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// Helper function to determine appropriate icon based on file format
function getIconForFormat(format) {
  const formatIcons = {
    'md': 'fa-markdown',
    'txt': 'fa-file-alt',
    'pdf': 'fa-file-pdf',
    'html': 'fa-file-code',
    'csv': 'fa-file-csv',
    'json': 'fa-file-code',
    'xml': 'fa-file-code',
    'yaml': 'fa-file-code',
    'yml': 'fa-file-code',
    'ini': 'fa-file-alt',
    'conf': 'fa-file-alt'
  };
  
  return formatIcons[format] || 'fa-file';
}

// @desc    Get single cheatsheet
// @route   GET /api/sheets/:id
// @access  Public
exports.getSheet = async (req, res) => {
  try {
    const sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Cheatsheet not found'
      });
    }

    res.status(200).json({
      success: true,
      data: sheet
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Create new cheatsheet
// @route   POST /api/sheets
// @access  Private
exports.createSheet = async (req, res) => {
  try {
    // Create sheet in database
    const sheet = await Sheet.create(req.body);

    res.status(201).json({
      success: true,
      data: sheet
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      
      return res.status(400).json({
        success: false,
        error: messages
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Server Error'
      });
    }
  }
};

// @desc    Update cheatsheet
// @route   PUT /api/sheets/:id
// @access  Private
exports.updateSheet = async (req, res) => {
  try {
    let sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Cheatsheet not found'
      });
    }

    // Update sheet
    sheet = await Sheet.findByIdAndUpdate(req.params.id, 
      { ...req.body, updatedAt: Date.now() }, 
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: sheet
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Delete cheatsheet
// @route   DELETE /api/sheets/:id
// @access  Private
exports.deleteSheet = async (req, res) => {
  try {
    const sheet = await Sheet.findById(req.params.id);

    if (!sheet) {
      return res.status(404).json({
        success: false,
        error: 'Cheatsheet not found'
      });
    }

    // Delete file from filesystem if it exists and not in the original sheets directory
    if (sheet.path && !sheet.path.startsWith('http')) {
      const filePath = path.join(__dirname, '..', sheet.path);
      const sheetsDir = path.join(__dirname, '..', process.env.FILE_STORAGE_PATH || '../data/sheets');
      
      // Only delete if it's not one of the original files
      if (fs.existsSync(filePath) && !filePath.includes('bash-cmd.md') && !filePath.includes('httpsrequests.html')) {
        await fs.unlink(filePath);
      }
    }

    await sheet.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
};

// @desc    Upload cheatsheet file
// @route   POST /api/sheets/upload
// @access  Private
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Please upload a file'
      });
    }

    // Get the relative path from the upload directory
    const sheetsDir = process.env.FILE_STORAGE_PATH || '../data/sheets';
    const relativePath = `${sheetsDir}/${req.file.filename}`;

    res.status(200).json({
      success: true,
      data: {
        fileName: req.file.filename,
        filePath: relativePath,
        format: path.extname(req.file.originalname).substring(1)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Server Error'
    });
  }
}; 