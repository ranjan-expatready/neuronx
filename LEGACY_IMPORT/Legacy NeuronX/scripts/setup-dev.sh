#!/bin/bash
set -e

echo "🚀 Setting up Development Environment..."

# 1. Node Version Management
echo "📦 Checking Node version..."
if command -v nvm &> /dev/null; then
    echo "   Detected nvm. Installing/using Node version from .nvmrc..."
    nvm install
    nvm use
elif [ -f "$HOME/.nvm/nvm.sh" ]; then
    echo "   Loading nvm..."
    . "$HOME/.nvm/nvm.sh"
    nvm install
    nvm use
else
    echo "⚠️  nvm not found."
    REQUIRED_VERSION=$(cat .nvmrc)
    CURRENT_VERSION=$(node -v)
    if [[ "$CURRENT_VERSION" != "v$REQUIRED_VERSION"* ]]; then
        echo "❌ Node version mismatch!"
        echo "   Required: v$REQUIRED_VERSION"
        echo "   Current:  $CURRENT_VERSION"
        echo "   Please install Node v$REQUIRED_VERSION or use nvm/fnm/volta."
        exit 1
    fi
    echo "   Using system Node: $CURRENT_VERSION (matches requirement)"
fi

# 2. Dependencies
echo "📦 Installing dependencies..."
if ! command -v pnpm &> /dev/null; then
    echo "   pnpm not found. Installing via npm..."
    npm install -g pnpm@9
fi

pnpm install --frozen-lockfile

echo "✅ Development environment ready!"
echo "   Run './scripts/verify-readiness.sh' to check system health."
