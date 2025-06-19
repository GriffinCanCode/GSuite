'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const basename = path.basename(__filename);
const db = {};

// Import the sequelize instance
const { sequelize } = require('../config/db');

// If sequelize is not initialized (using local storage), return empty db object
if (!sequelize) {
  console.log('No Sequelize instance available. Using local storage instead.');
  module.exports = db;
  return;
}

try {
  // Read all model files and import them
  fs.readdirSync(__dirname)
    .filter(file => {
      return (
        file.indexOf('.') !== 0 &&
        file !== basename &&
        file.slice(-3) === '.js' &&
        !file.includes('.model.js') // Exclude mongoose models
      );
    })
    .forEach(file => {
      try {
        const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
        db[model.name] = model;
      } catch (err) {
        console.error(`Error loading model file ${file}:`, err.message);
      }
    });

  // Associate models if associations exist
  Object.keys(db).forEach(modelName => {
    if (db[modelName].associate) {
      db[modelName].associate(db);
    }
  });

  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
} catch (error) {
  console.error('Error loading models:', error.message);
}

module.exports = db; 