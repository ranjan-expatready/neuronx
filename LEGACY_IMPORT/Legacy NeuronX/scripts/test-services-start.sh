#!/bin/bash

# WI-068: E2E Journey Proof Pack - Service Startup Script
# Starts all services needed for E2E journey testing

set -e

echo "🚀 Starting NeuronX E2E Test Services..."

# Set UAT environment variables
export NEURONX_ENV=uat
export UAT_MODE=dry_run
export UAT_TENANT_ID=uat-tenant-001
export UAT_KILL_SWITCH=true

# Function to wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1

    echo "⏳ Waiting for $service_name to be ready at $url..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s -f "$url/health" > /dev/null 2>&1; then
            echo "✅ $service_name is ready"
            return 0
        fi

        echo "  Attempt $attempt/$max_attempts failed, retrying in 2 seconds..."
        sleep 2
        ((attempt++))
    done

    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Start Core API in background
echo "📡 Starting Core API..."
cd apps/core-api
npm run start:dev > ../../../logs/core-api.log 2>&1 &
CORE_API_PID=$!
cd ../../

# Wait for Core API
wait_for_service "http://localhost:3000" "Core API"

# Start Operator UI in background
echo "👨‍💼 Starting Operator UI..."
cd apps/operator-ui
npm run dev > ../../../logs/operator-ui.log 2>&1 &
OPERATOR_UI_PID=$!
cd ../../

# Wait for Operator UI
wait_for_service "http://localhost:3001" "Operator UI"

# Start Manager UI in background
echo "👔 Starting Manager UI..."
cd apps/manager-ui
npm run dev > ../../../logs/manager-ui.log 2>&1 &
MANAGER_UI_PID=$!
cd ../../

# Wait for Manager UI
wait_for_service "http://localhost:3002" "Manager UI"

# Start Executive UI in background
echo "🏢 Starting Executive UI..."
cd apps/executive-ui
npm run dev > ../../../logs/executive-ui.log 2>&1 &
EXECUTIVE_UI_PID=$!
cd ../../

# Wait for Executive UI
wait_for_service "http://localhost:3003" "Executive UI"

echo ""
echo "🎉 All services started successfully!"
echo ""
echo "Service URLs:"
echo "  Core API:     http://localhost:3000"
echo "  Operator UI:  http://localhost:3001"
echo "  Manager UI:   http://localhost:3002"
echo "  Executive UI: http://localhost:3003"
echo ""
echo "Environment:"
echo "  NEURONX_ENV:  $NEURONX_ENV"
echo "  UAT_MODE:     $UAT_MODE"
echo "  UAT_TENANT_ID: $UAT_TENANT_ID"
echo ""
echo "Process IDs:"
echo "  Core API:     $CORE_API_PID"
echo "  Operator UI:  $OPERATOR_UI_PID"
echo "  Manager UI:   $MANAGER_UI_PID"
echo "  Executive UI: $EXECUTIVE_UI_PID"
echo ""
echo "To stop all services, run:"
echo "  kill $CORE_API_PID $OPERATOR_UI_PID $MANAGER_UI_PID $EXECUTIVE_UI_PID"
echo ""
echo "Ready for E2E testing! 🧪"

# Keep script running to maintain services
echo "Press Ctrl+C to stop all services..."
trap "echo '🛑 Stopping services...'; kill $CORE_API_PID $OPERATOR_UI_PID $MANAGER_UI_PID $EXECUTIVE_UI_PID 2>/dev/null; exit" INT
wait

