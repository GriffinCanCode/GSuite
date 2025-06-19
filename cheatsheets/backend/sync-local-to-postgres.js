/**
 * Utility script to manually sync local data to PostgreSQL
 * Run with: node sync-local-to-postgres.js
 */

require('dotenv').config();
const fs = require('fs-extra');
const path = require('path');
const { Sequelize } = require('sequelize');

// Create a connection to the database (without connecting to specific DB first)
let sequelize = null;
try {
  // First try connecting to postgres DB to check if it exists
  sequelize = new Sequelize('postgres', process.env.DB_USER, process.env.DB_PASSWORD, {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: console.log
  });
  
  console.log('Successfully connected to PostgreSQL server');
} catch (error) {
  console.error('Unable to connect to PostgreSQL server:', error.message);
  process.exit(1);
}

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

// Sync local data to PostgreSQL
const syncLocalDataWithPostgreSQL = async () => {
  console.log('Syncing local data with PostgreSQL...');
  try {
    // Read local sheets data
    const sheetsFile = path.join(__dirname, '../data/sheets.json');
    if (fs.existsSync(sheetsFile)) {
      const localData = fs.readJsonSync(sheetsFile);
      
      if (localData.sheets && localData.sheets.length > 0) {
        console.log(`Found ${localData.sheets.length} sheets in local storage`);
        
        // For each local sheet, check if it exists in PostgreSQL and add if not
        for (const sheet of localData.sheets) {
          // Look for existing sheet with same name or path
          const results = await sequelize.query(
            `SELECT * FROM sheets WHERE name = $1 OR path = $2`,
            {
              replacements: [sheet.name, sheet.path],
              type: Sequelize.QueryTypes.SELECT
            }
          ).catch(() => []);
          
          if (!results || results.length === 0) {
            // Create new sheet in PostgreSQL
            await sequelize.query(
              `INSERT INTO sheets (
                id, name, category, format, path, icon, tags, "isPublic",
                "createdAt", "updatedAt"
              ) VALUES (
                gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7,
                CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
              )`,
              {
                replacements: [
                  sheet.name,
                  sheet.category,
                  sheet.format,
                  sheet.path,
                  sheet.icon || getIconForFormat(sheet.format),
                  sheet.tags ? JSON.stringify(sheet.tags) : '[]',
                  true
                ]
              }
            );
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

// Connect to PostgreSQL and sync data
const start = async () => {
  try {
    if (process.env.DB_TYPE !== 'postgres') {
      console.error('PostgreSQL not configured in .env file. Set DB_TYPE=postgres.');
      process.exit(1);
    }

    // Check if the cheatsheets DB exists
    try {
      await sequelize.query(`SELECT 1 FROM pg_database WHERE datname = $1`, {
        replacements: [process.env.DB_NAME],
        type: Sequelize.QueryTypes.SELECT
      });
    } catch (error) {
      console.log(`Database "${process.env.DB_NAME}" does not exist, creating it...`);
      
      // Create the database
      await sequelize.query(`CREATE DATABASE "${process.env.DB_NAME}"`);
      console.log(`Database "${process.env.DB_NAME}" created successfully`);
    }
    
    // Close the postgres connection and connect to the actual DB
    await sequelize.close();
    
    // Now connect to the cheatsheets database
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER,
      process.env.DB_PASSWORD, 
      {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'postgres',
        logging: console.log
      }
    );
    
    await sequelize.authenticate();
    console.log(`Connected to ${process.env.DB_NAME} database`);
    
    // Create sheets table if it doesn't exist
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS sheets (
        id UUID PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(255) NOT NULL DEFAULT 'other',
        format VARCHAR(50) NOT NULL,
        path VARCHAR(255) NOT NULL,
        icon VARCHAR(100),
        tags TEXT,
        "isPublic" BOOLEAN DEFAULT TRUE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
      )
    `);
    console.log('Ensured sheets table exists');
    
    // Sync data
    await syncLocalDataWithPostgreSQL();
    
    // Close connection when done
    await sequelize.close();
    console.log('Disconnected from PostgreSQL');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Run the script
start(); 