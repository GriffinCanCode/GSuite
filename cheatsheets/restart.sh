#!/bin/bash

echo "Stopping existing servers..."
pkill -f "node server.js" || true
pkill -f "python -m http.server" || true

echo "Checking PostgreSQL status..."
# Check if PostgreSQL is running
if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
  echo "PostgreSQL is running"
else
  echo "PostgreSQL is not running. Please make sure PostgreSQL is installed and running."
  echo "Will continue with local file storage mode."
  # Update .env to disable PostgreSQL
  sed -i '' 's/^DB_TYPE=postgres/# DB_TYPE=postgres/' backend/.env || true
fi

echo "Installing dependencies..."
cd backend
npm install
cd ..

echo "Ensuring PostgreSQL connection is configured..."
# Make sure DB_TYPE is set to postgres in .env file
if grep -q "^# DB_TYPE=postgres" backend/.env; then
  if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "Enabling PostgreSQL connection in .env..."
    sed -i '' 's/^# DB_TYPE=postgres/DB_TYPE=postgres/' backend/.env
  fi
fi

echo "Syncing local data to PostgreSQL..."
cd backend
node sync-local-to-postgres.js || echo "PostgreSQL sync failed, continuing with startup. Please check your database configuration."
cd ..

echo "Restarting servers..."
./launch.sh 