/**
 * Utility script to manually sync local data to MongoDB
 * Run with: node sync-local-to-mongo.js
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const mongoose = require('mongoose');

// Import models
const Sheet = require('./models/sheet.model');

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

// Sync local data to MongoDB
const syncLocalDataWithMongoDB = async () => {
  console.log('Syncing local data with MongoDB...');
  try {
    // Read local sheets data
    const sheetsFile = path.join(__dirname, '../data/sheets.json');
    if (fs.existsSync(sheetsFile)) {
      const localData = fs.readJsonSync(sheetsFile);
      
      if (localData.sheets && localData.sheets.length > 0) {
        console.log(`Found ${localData.sheets.length} sheets in local storage`);
        
        // For each local sheet, check if it exists in MongoDB and add if not
        for (const sheet of localData.sheets) {
          // Look for existing sheet with same name or path
          const existingSheet = await Sheet.findOne({ 
            $or: [
              { name: sheet.name },
              { path: sheet.path }
            ]
          });
          
          if (!existingSheet) {
            // Create new sheet in MongoDB
            await Sheet.create({
              name: sheet.name,
              category: sheet.category,
              format: sheet.format,
              path: sheet.path,
              icon: sheet.icon || getIconForFormat(sheet.format),
              tags: sheet.tags || [],
              isPublic: true
            });
            console.log(`Added sheet: ${sheet.name} to MongoDB`);
          } else {
            console.log(`Sheet already exists in MongoDB: ${sheet.name}`);
          }
        }
      }
    }
    
    // Import other models and sync other data as needed
    // Add similar code for users or other data types
    
    console.log('Data sync complete');
  } catch (error) {
    console.error('Error syncing data with MongoDB:', error);
  }
};

// Connect to MongoDB and sync data
const start = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error('MONGO_URI not defined in .env file');
      process.exit(1);
    }

    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Sync data
    await syncLocalDataWithMongoDB();
    
    // Disconnect when done
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run the script
start(); 