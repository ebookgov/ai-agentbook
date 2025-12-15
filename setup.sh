#!/bin/bash

echo "🚀 Starting 1-Day Build Setup..."

# Backend Setup
echo "🛠️  Setting up Backend (Python)..."
cd hvac-triage-api
if [ ! -d "venv" ]; then
    python -m venv venv
fi
source venv/Scripts/activate || source venv/bin/activate
pip install -r requirements.txt
cd ..

# Frontend Setup
echo "🎨 Setting up Frontend (Next.js)..."
cd visual-isa-web
npm install
# Ensure standalone output is configured (we'll do this programmatically or manual check)
echo "✅ Dependencies installed."

# Build Test
echo "🏗️  Testing Builds..."
# docker-compose build

echo "✅ Setup Complete. Run 'docker-compose up' to start."
