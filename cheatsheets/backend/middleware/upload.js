const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs-extra');

// Setup storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sheetsDir = process.env.FILE_STORAGE_PATH || '../data/sheets';
    // Ensure the directory exists
    fs.ensureDirSync(sheetsDir);
    cb(null, sheetsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename while preserving original extension
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const fileExt = path.extname(file.originalname);
    const fileName = file.originalname.replace(fileExt, '');
    
    // Create a file name that's URL-friendly
    const sanitizedName = fileName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
      
    cb(null, `${sanitizedName}-${uniqueSuffix}${fileExt}`);
  }
});

// Check file type
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const allowedExtensions = [
    '.md', '.txt', '.pdf', '.html', '.csv',
    '.json', '.xml', '.yaml', '.yml', '.ini', '.conf'
  ];
  
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(fileExt)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only markdown, text, PDF, HTML, CSV, JSON, XML, YAML, INI, and CONF files are allowed.'), false);
  }
};

// Configure upload
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

module.exports = upload; 