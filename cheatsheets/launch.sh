#!/bin/bash

# CheatSheets Hub Launcher
# This script starts a local server to serve the cheatsheets application

echo "Starting Griffin's CheatSheets..."

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"
echo "Running server from: $SCRIPT_DIR"

# Function to kill any existing servers
kill_existing_servers() {
    echo "Checking for existing servers..."
    
    # Check and kill processes on port 5001 (backend)
    if lsof -i :5001 > /dev/null 2>&1; then
        echo "Killing processes on port 5001 (backend)..."
        lsof -i :5001 -t | xargs kill -9 2>/dev/null
    fi
    
    # Check and kill processes on port 8000 (frontend)
    if lsof -i :8000 > /dev/null 2>&1; then
        echo "Killing processes on port 8000 (frontend)..."
        lsof -i :8000 -t | xargs kill -9 2>/dev/null
    fi
    
    # Also try to kill by process name
    pkill -f "node server.js" 2>/dev/null
    pkill -f "nodemon server.js" 2>/dev/null
    pkill -f "python -m http.server" 2>/dev/null
    pkill -f "python -m SimpleHTTPServer" 2>/dev/null
    
    # Wait a moment for processes to be fully terminated
    sleep 1
}

# Kill any existing servers first
kill_existing_servers

# Check PostgreSQL status
check_postgres_status() {
    echo "Checking PostgreSQL status..."
    if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
        echo "PostgreSQL is running. Local data will be synced automatically."
    else
        echo "PostgreSQL is not running. Starting in local storage mode."
        # Comment out PostgreSQL configuration in .env to use local storage
        if grep -q "^DB_TYPE=postgres" backend/.env; then
            echo "PostgreSQL not available, using local storage instead."
            sed -i '' 's/^DB_TYPE=postgres/# DB_TYPE=postgres/' backend/.env || true
        fi
    fi
}

# Run PostgreSQL check
check_postgres_status

# Check if index.html exists in the current directory
if [ ! -f "$SCRIPT_DIR/frontend/index.html" ]; then
    echo "Error: index.html not found in $SCRIPT_DIR/frontend"
    echo "Make sure you're running this script from the correct directory"
    exit 1
fi

# Check if backend directory exists
if [ ! -d "$SCRIPT_DIR/backend" ]; then
    echo "Error: backend directory not found in $SCRIPT_DIR"
    echo "Make sure you have set up the backend"
    exit 1
fi

# Function to start the backend server
start_backend() {
    echo "Starting backend server..."
    cd "$SCRIPT_DIR/backend"
    if [ -x "$(command -v npm)" ]; then
        # Check if node_modules exists, install if not
        if [ ! -d "$SCRIPT_DIR/backend/node_modules" ]; then
            echo "Installing backend dependencies..."
            npm install
        fi
        
        # Start the backend server
        echo "Starting backend with npm run dev..."
        npm run dev &
        BACKEND_PID=$!
        echo "Backend running with PID: $BACKEND_PID"
        
        # Wait for backend to become available
        echo "Waiting for backend to start..."
        RETRY_COUNT=0
        MAX_RETRIES=30
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if curl -s "http://localhost:5001/api/health" > /dev/null; then
                echo "Backend is running!"
                # Check if database is connected
                DB_STATUS=$(curl -s "http://localhost:5001/api/health" | grep -o '"dbStatus":"[^"]*"' | cut -d'"' -f4)
                echo "Database status: $DB_STATUS"
                break
            fi
            RETRY_COUNT=$((RETRY_COUNT+1))
            echo "Waiting for backend to start... (${RETRY_COUNT}/${MAX_RETRIES})"
            sleep 1
        done
        
        if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
            echo "ERROR: Backend server failed to start properly. Check logs in backend directory."
            echo "You can try to start the servers manually:"
            echo "1. cd backend && npm run dev"
            echo "2. In another terminal: python -m http.server"
            stop_servers
            exit 1
        fi
    else
        echo "Error: npm not found. Please install Node.js and npm."
        exit 1
    fi
    cd "$SCRIPT_DIR"
}

# Function to stop all running servers
stop_servers() {
    echo "Stopping servers..."
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$SERVER_PID" ]; then
        kill $SERVER_PID 2>/dev/null
    fi
    exit 0
}

# Trap SIGINT and SIGTERM to properly clean up servers
trap stop_servers INT TERM

# Start backend server
start_backend

# Check if Python 3 is installed
if command -v python3 &>/dev/null; then
    echo "Starting frontend server with Python 3..."
    echo "Open your browser and navigate to http://localhost:8000/frontend/index.html"
    # Start server in background
    cd "$SCRIPT_DIR"
    python3 -m http.server &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 1
    
    # Open the index.html directly
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open http://localhost:8000/frontend/index.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open http://localhost:8000/frontend/index.html
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        start http://localhost:8000/frontend/index.html
    else
        echo "Could not detect your operating system. Please open http://localhost:8000/frontend/index.html manually."
    fi
    
    # Keep script running until Ctrl+C
    echo "Servers running... Press Ctrl+C to stop"
    wait $SERVER_PID
elif command -v python &>/dev/null; then
    # Check Python version
    PYTHON_VERSION=$(python --version 2>&1)
    if [[ $PYTHON_VERSION == *"Python 3"* ]]; then
        echo "Starting frontend server with Python..."
        echo "Open your browser and navigate to http://localhost:8000/frontend/index.html"
        # Start server in background
        cd "$SCRIPT_DIR"
        python -m http.server &
        SERVER_PID=$!
        
        # Wait a moment for server to start
        sleep 1
        
        # Open the index.html directly
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open http://localhost:8000/frontend/index.html
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open http://localhost:8000/frontend/index.html
        elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            start http://localhost:8000/frontend/index.html
        else
            echo "Could not detect your operating system. Please open http://localhost:8000/frontend/index.html manually."
        fi
        
        # Keep script running until Ctrl+C
        echo "Servers running... Press Ctrl+C to stop"
        wait $SERVER_PID
    else
        echo "Starting frontend server with Python 2..."
        echo "Open your browser and navigate to http://localhost:8000/frontend/index.html"
        # Start server in background
        cd "$SCRIPT_DIR"
        python -m SimpleHTTPServer 8000 &
        SERVER_PID=$!
        
        # Wait a moment for server to start
        sleep 1
        
        # Open the index.html directly
        if [[ "$OSTYPE" == "darwin"* ]]; then
            open http://localhost:8000/frontend/index.html
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            xdg-open http://localhost:8000/frontend/index.html
        elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
            start http://localhost:8000/frontend/index.html
        else
            echo "Could not detect your operating system. Please open http://localhost:8000/frontend/index.html manually."
        fi
        
        # Keep script running until Ctrl+C
        echo "Servers running... Press Ctrl+C to stop"
        wait $SERVER_PID
    fi
else
    echo "Python not found. Please install Python or manually open index.html in your browser."
    
    # Try to open the file directly with the default browser
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo "Attempting to open with default browser..."
        open frontend/index.html
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Attempting to open with default browser..."
        xdg-open frontend/index.html
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
        echo "Attempting to open with default browser..."
        start frontend/index.html
    else
        echo "Could not detect your operating system. Please open frontend/index.html manually."
    fi
fi 