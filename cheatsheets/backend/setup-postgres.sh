#!/bin/bash

# Setup PostgreSQL for CheatSheets Hub
echo "Setting up PostgreSQL for CheatSheets Hub"

# Check if PostgreSQL is installed
if command -v psql >/dev/null 2>&1; then
    echo "PostgreSQL is installed"
else
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    echo "Visit https://www.postgresql.org/download/ for instructions."
    exit 1
fi

# Check if PostgreSQL is running
if pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "PostgreSQL is running"
else
    echo "PostgreSQL is not running. Please start PostgreSQL service."
    echo "On macOS: brew services start postgresql"
    echo "On Linux: sudo service postgresql start"
    echo "On Windows: Start the PostgreSQL service from Services"
    exit 1
fi

# Create database if it doesn't exist
DB_NAME="cheatsheets"
DB_USER="postgres"  # Default PostgreSQL user
DB_PASSWORD="postgres"  # Unsecure password

# Update .env file with PostgreSQL configuration first
echo "Updating .env file with PostgreSQL configuration..."
ENV_FILE="$(pwd)/.env"

if [ -f "$ENV_FILE" ]; then
    # Update DB_TYPE
    if grep -q "DB_TYPE=" "$ENV_FILE"; then
        sed -i.bak -e 's/^# DB_TYPE=postgres/DB_TYPE=postgres/' "$ENV_FILE" && rm "$ENV_FILE.bak" || true
    else
        echo "DB_TYPE=postgres" >> "$ENV_FILE"
    fi

    # Update DB_HOST
    if grep -q "DB_HOST=" "$ENV_FILE"; then
        sed -i.bak -e 's/^DB_HOST=.*/DB_HOST=localhost/' "$ENV_FILE" && rm "$ENV_FILE.bak" || true
    else
        echo "DB_HOST=localhost" >> "$ENV_FILE"
    fi

    # Update DB_PORT
    if grep -q "DB_PORT=" "$ENV_FILE"; then
        sed -i.bak -e 's/^DB_PORT=.*/DB_PORT=5432/' "$ENV_FILE" && rm "$ENV_FILE.bak" || true
    else
        echo "DB_PORT=5432" >> "$ENV_FILE"
    fi

    # Update DB_NAME
    if grep -q "DB_NAME=" "$ENV_FILE"; then
        sed -i.bak -e 's/^DB_NAME=.*/DB_NAME=cheatsheets/' "$ENV_FILE" && rm "$ENV_FILE.bak" || true
    else
        echo "DB_NAME=cheatsheets" >> "$ENV_FILE"
    fi

    # Update DB_USER
    if grep -q "DB_USER=" "$ENV_FILE"; then
        sed -i.bak -e 's/^DB_USER=.*/DB_USER=postgres/' "$ENV_FILE" && rm "$ENV_FILE.bak" || true
    else
        echo "DB_USER=postgres" >> "$ENV_FILE"
    fi

    # Update DB_PASSWORD
    if grep -q "DB_PASSWORD=" "$ENV_FILE"; then
        sed -i.bak -e 's/^DB_PASSWORD=.*/DB_PASSWORD=postgres/' "$ENV_FILE" && rm "$ENV_FILE.bak" || true
    else
        echo "DB_PASSWORD=postgres" >> "$ENV_FILE"
    fi
else
    echo "Error: .env file not found at $ENV_FILE"
    echo "Creating .env file with PostgreSQL configuration..."
    cat > "$ENV_FILE" << EOF
PORT=5001
NODE_ENV=development

# Database Configuration
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cheatsheets
DB_USER=postgres
DB_PASSWORD=postgres

# File paths
FILE_STORAGE_PATH=../data/sheets
LOGS_PATH=../data/logs
EOF
    echo "Created .env file with PostgreSQL configuration"
fi

# Check if the database already exists
echo "Checking if database '$DB_NAME' exists..."
if psql -U "$DB_USER" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
    echo "Database '$DB_NAME' already exists"
else
    echo "Creating database '$DB_NAME'..."
    
    # Try to create the database using the default postgres user
    if ! psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"; then
        echo "Retrying with password authentication..."
        # If that fails, try with password authentication
        PGPASSWORD="$DB_PASSWORD" psql -U "$DB_USER" -h localhost -c "CREATE DATABASE $DB_NAME;" || {
            echo "Failed to create database. Please create it manually with:"
            echo "createdb $DB_NAME"
            echo "or"
            echo "psql -U postgres -c \"CREATE DATABASE $DB_NAME;\""
            exit 1
        }
    fi
    
    echo "Database created successfully"
fi

echo "PostgreSQL setup complete!"
echo "You can now run the application with './restart.sh'" 