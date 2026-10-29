#!/usr/bin/env bash
# ==============================================================================
# TrackOps - Startup Script (Linux / macOS / WSL)
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "========================================================"
echo "Starting TrackOps Production Server (Port 5000)..."
echo "========================================================"

# Check if PostgreSQL service is running if on Linux/WSL
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl status postgresql >/dev/null 2>&1 || sudo systemctl start postgresql
elif command -v service >/dev/null 2>&1; then
    sudo service postgresql status >/dev/null 2>&1 || sudo service postgresql start
fi

# Ensure dependencies and production build exist
if [ ! -d "dist" ]; then
    echo "Production build not found. Running build..."
    npm run build
fi

# Open browser if available
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5000" >/dev/null 2>&1 &
elif command -v open >/dev/null 2>&1; then
    open "http://localhost:5000" >/dev/null 2>&1 &
fi

echo "Launching backend server on port 5000..."
npm run start
