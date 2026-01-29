#!/bin/bash
# Startup script for Ollama Gateway

set -e

echo "🚀 Starting Ollama Gateway..."
echo "📍 Gateway URL: http://127.0.0.1:4000"
echo "🔗 Ollama URL: http://localhost:11434"
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null; then
    echo "❌ Ollama is not running. Please start Ollama first:"
    echo "   ollama serve"
    exit 1
fi

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "⚠️  .env file not found. Copying from example..."
    if [ -f "env-example.txt" ]; then
        cp env-example.txt .env
        echo "✅ Created .env from env-example.txt"
        echo "⚠️  Please edit .env and set a secure PROXY_API_KEY"
    else
        echo "❌ env-example.txt not found. Creating basic .env..."
        echo "PROXY_API_KEY=change-this-key" > .env
    fi
fi

# Set Python path for virtual environment if it exists
if [ -d "venv" ]; then
    echo "🐍 Using virtual environment"
    source venv/bin/activate
fi

# Start the gateway
echo "🌐 Starting gateway on http://127.0.0.1:4000"
echo "🛑 Press Ctrl+C to stop"
echo ""

python3 main.py