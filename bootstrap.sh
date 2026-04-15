#!/bin/bash
# Foreigner Housing OS V1.4 — One-click bootstrap
# Usage: bash bootstrap.sh
set -e

echo "Foreigner Housing OS · V1.4 Bootstrap"
echo "======================================"

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 not found"
    exit 1
fi

PYVER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "Python: $PYVER"

# Check SQLite version (need 3.38+ for json_array_length)
SQVER=$(python3 -c "import sqlite3; print(sqlite3.sqlite_version)")
echo "SQLite: $SQVER"

# Copy .env if not present
if [ ! -f .env ]; then
    cp .env.example .env
    echo "Created .env from .env.example"
fi

# Init database
echo ""
python3 init_db.py

# Run demo
echo ""
echo "Running end-to-end demo..."
echo ""
python3 -m housing_os demo
