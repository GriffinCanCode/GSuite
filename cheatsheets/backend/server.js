const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Create logs directory if it doesn't exist
const logsDir = process.env.LOGS_PATH || '../data/logs';
fs.ensureDirSync(logsDir);

// Set up logging
const accessLogStream = fs.createWriteStream(
  path.join(__dirname, logsDir, 'access.log'),
  { flags: 'a' }
);

// Middleware
app.use(cors({
  origin: ['http://localhost:8000', 'http://127.0.0.1:8000', 'http://localhost:5001', 'http://127.0.0.1:5001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: accessLogStream }));
app.use(morgan('dev')); // Also log to console for development

// Create uploads directory if it doesn't exist
const sheetsDir = process.env.FILE_STORAGE_PATH || '../data/sheets';
fs.ensureDirSync(sheetsDir);
app.use('/sheets', express.static(path.join(__dirname, sheetsDir)));

// Import routes
let sheetRoutes, userRoutes;

// Connect to database (async)
(async () => {
  const isConnected = await connectDB();
  
  // Import appropriate routes based on connection status
  if (isConnected) {
    sheetRoutes = require('./routes/sheet.routes');
    userRoutes = require('./routes/user.routes');
  } else {
    // Use fallback local file storage routes
    sheetRoutes = require('./routes/sheet.local.routes');
    userRoutes = require('./routes/user.local.routes');
    
    // Create the local routes files if they don't exist
    createLocalRoutesIfNeeded();
  }
  
  // Use routes
  app.use('/api/sheets', sheetRoutes);
  app.use('/api/users', userRoutes);
})();

// Function to create local routes files if they don't exist
function createLocalRoutesIfNeeded() {
  const routesDir = path.join(__dirname, 'routes');
  const sheetLocalRoutesPath = path.join(routesDir, 'sheet.local.routes.js');
  const userLocalRoutesPath = path.join(routesDir, 'user.local.routes.js');
  
  // Create sheet.local.routes.js if it doesn't exist
  if (!fs.existsSync(sheetLocalRoutesPath)) {
    const sheetLocalRoutes = `
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
`;
    fs.writeFileSync(sheetLocalRoutesPath, sheetLocalRoutes);
    console.log('Created local sheet routes file');
  }

  // Create user.local.routes.js if it doesn't exist
  if (!fs.existsSync(userLocalRoutesPath)) {
    const userLocalRoutes = `
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

module.exports = router;
`;
    fs.writeFileSync(userLocalRoutesPath, userLocalRoutes);
    console.log('Created local user routes file');
  }
}

// Add health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Backend server is running properly',
    timestamp: new Date().toISOString(),
    dbStatus: connectDB.isConnected() ? 'connected' : 'using local storage'
  });
});

// Serve static files from the frontend in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(__dirname, '../frontend');
  app.use(express.static(frontendPath));
  
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  // Log error to file
  const errorLogStream = fs.createWriteStream(
    path.join(__dirname, logsDir, 'error.log'),
    { flags: 'a' }
  );
  errorLogStream.write(`${new Date().toISOString()} - ${err.stack}\n`);
  
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: err.message || 'Server Error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 