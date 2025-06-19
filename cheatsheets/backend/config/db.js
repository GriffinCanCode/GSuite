const { Sequelize } = require('sequelize');
const fs = require('fs-extra');
const path = require('path');

// Global flag to indicate database connection status
let isDbConnected = false;

// Create Sequelize instance
let sequelize = null;
try {
  if (process.env.DB_TYPE === 'postgres') {
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD, 
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' ? console.log : false
      }
    );
    console.log('Sequelize instance created with PostgreSQL config');
  } else {
    console.log('PostgreSQL not configured. Will use local storage.');
  }
} catch (error) {
  console.error('Error creating Sequelize instance:', error.message);
  sequelize = null;
}

// Connect to the database
const connectDB = async () => {
  try {
    // Check if PostgreSQL configuration is provided
    if (!sequelize || process.env.DB_TYPE !== 'postgres') {
      console.log('PostgreSQL configuration not found. Using local file storage instead.');
      setupLocalStorage();
      return false;
    }

    // Test connection
    await sequelize.authenticate();
    console.log(`PostgreSQL Connected: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
    isDbConnected = true;
    
    // Sync models with database
    // Note: In production, you'd use migrations instead
    await sequelize.sync();
    console.log('All models were synchronized successfully.');
    
    // Sync local data with PostgreSQL
    await syncLocalDataWithPostgreSQL();
    
    return true;
  } catch (error) {
    console.error(`Database Connection Error: ${error.message}`);
    console.log('Falling back to local file storage.');
    setupLocalStorage();
    return false;
  }
};

// Setup local storage directory
const setupLocalStorage = () => {
  const dataDir = path.join(__dirname, '../../data');
  const sheetsDataFile = path.join(dataDir, 'sheets.json');
  const usersDataFile = path.join(dataDir, 'users.json');
  
  // Ensure data directory exists
  fs.ensureDirSync(dataDir);
  
  // Create default files if they don't exist
  if (!fs.existsSync(sheetsDataFile)) {
    fs.writeJsonSync(sheetsDataFile, { sheets: [] }, { spaces: 2 });
  }
  
  if (!fs.existsSync(usersDataFile)) {
    fs.writeJsonSync(usersDataFile, { users: [] }, { spaces: 2 });
  }
  
  console.log('Local file storage initialized.');
};

// Sync local data with PostgreSQL
const syncLocalDataWithPostgreSQL = async () => {
  if (!sequelize) {
    console.log('Skipping data sync - Sequelize not initialized');
    return;
  }
  
  console.log('Syncing local data with PostgreSQL...');
  try {
    // Import Sheet model (will be defined in models directory)
    const { Sheet } = require('../models');
    
    // Read local sheets data
    const sheetsFile = path.join(__dirname, '../../data/sheets.json');
    if (fs.existsSync(sheetsFile)) {
      const localData = fs.readJsonSync(sheetsFile);
      
      if (localData.sheets && localData.sheets.length > 0) {
        console.log(`Found ${localData.sheets.length} sheets in local storage`);
        
        // For each local sheet, check if it exists in PostgreSQL and add if not
        for (const sheet of localData.sheets) {
          // Look for existing sheet with same name or path
          const existingSheet = await Sheet.findOne({ 
            where: {
              [Sequelize.Op.or]: [
                { name: sheet.name },
                { path: sheet.path }
              ]
            }
          });
          
          if (!existingSheet) {
            // Create new sheet in PostgreSQL
            await Sheet.create({
              name: sheet.name,
              category: sheet.category,
              format: sheet.format,
              path: sheet.path,
              icon: sheet.icon || getIconForFormat(sheet.format),
              tags: sheet.tags ? JSON.stringify(sheet.tags) : '[]',
              isPublic: true
            });
            console.log(`Added sheet: ${sheet.name} to PostgreSQL`);
          } else {
            console.log(`Sheet already exists in PostgreSQL: ${sheet.name}`);
          }
        }
      }
    }
    
    console.log('Data sync complete');
  } catch (error) {
    console.error('Error syncing data with PostgreSQL:', error);
  }
};

// Helper function to determine icon based on format
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

// Check if database is connected
const isConnected = () => isDbConnected;

// Export the Sequelize instance and connection functions
module.exports = connectDB;
module.exports.sequelize = sequelize;
module.exports.isConnected = isConnected; 