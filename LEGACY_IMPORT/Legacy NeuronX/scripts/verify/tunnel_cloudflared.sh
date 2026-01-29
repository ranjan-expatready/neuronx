#!/bin/bash

# NeuronX GHL Integration - Cloudflared Tunnel Setup
# This script sets up a secure tunnel for testing real OAuth and webhooks

set -e

echo "🚀 NeuronX GHL Integration - Cloudflared Tunnel Setup"
echo "=================================================="

# Check if cloudflared is installed
if ! command -v cloudflared &> /dev/null; then
    echo "❌ cloudflared not found"
    echo ""
    echo "📦 Install cloudflared:"
    echo ""
    echo "  macOS (brew):"
    echo "    brew install cloudflared"
    echo ""
    echo "  Linux (apt):"
    echo "    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o cloudflared.deb"
    echo "    sudo dpkg -i cloudflared.deb"
    echo ""
    echo "  Linux (yum):"
    echo "    curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-x86_64.rpm -o cloudflared.rpm"
    echo "    sudo rpm -i cloudflared.rpm"
    echo ""
    echo "  Or download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/tunnel-guide"
    echo ""
    exit 1
fi

echo "✅ cloudflared found: $(cloudflared version)"

# Check if NeuronX is running
echo ""
echo "🔍 Checking if NeuronX is running on localhost:3000..."
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ NeuronX appears to be running"
else
    echo "❌ NeuronX not detected on localhost:3000"
    echo ""
    echo "💡 Start NeuronX first:"
    echo "  cd apps/core-api"
    echo "  pnpm run start:dev"
    echo ""
    exit 1
fi

echo ""
echo "🌐 Starting cloudflared tunnel..."
echo "   This will create a secure public URL for your local NeuronX instance"
echo "   Press Ctrl+C to stop the tunnel"
echo ""

# Start the tunnel and capture the URL
# cloudflared tunnel output goes to stderr, so we need to parse it
tunnel_output=$(cloudflared tunnel --url http://localhost:3000 2>&1)

# Extract the URL from the output
tunnel_url=$(echo "$tunnel_output" | grep -o 'https://[^ ]*\.trycloudflare\.com' | head -1)

if [ -z "$tunnel_url" ]; then
    echo "❌ Failed to extract tunnel URL from cloudflared output"
    echo ""
    echo "🔍 Full output:"
    echo "$tunnel_output"
    echo ""
    echo "💡 Try running: cloudflared tunnel --url http://localhost:3000"
    echo "   Look for the URL in the output (usually ends with .trycloudflare.com)"
    exit 1
fi

echo ""
echo "🎉 Tunnel established!"
echo "============================"
echo "🌐 Public URL: $tunnel_url"
echo ""
echo "📝 NEXT STEPS:"
echo "=============="
echo ""
echo "1️⃣  Copy this URL and set in your .env file:"
echo "   BASE_URL=$tunnel_url"
echo "   GHL_REDIRECT_URI=${tunnel_url}/integrations/ghl/auth/callback"
echo ""
echo "2️⃣  In GoHighLevel app settings:"
echo "   - Redirect URI: ${tunnel_url}/integrations/ghl/auth/callback"
echo "   - Webhook URL: ${tunnel_url}/integrations/ghl/webhooks"
echo ""
echo "3️⃣  Restart NeuronX with updated .env"
echo ""
echo "4️⃣  Run verification:"
echo "   ./scripts/verify/verify_local_health.sh"
echo "   ./scripts/verify/verify_oauth_install_url.sh"
echo ""
echo "🛑 Press Ctrl+C to stop the tunnel"
echo ""

# Wait for tunnel to be stopped
wait


