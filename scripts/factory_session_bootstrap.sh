#!/bin/bash

# Factory Session Bootstrap Script
# Provides quick state summary for Factory sessions
# Exits with error code if readiness is RED

set -e

echo "=== NeuronX Factory Session Bootstrap ==="
echo ""

# Check if we're in the right directory
if [[ ! -f "AGENTS.md" ]]; then
    echo "ERROR: Must run from NeuronX repository root"
    echo "Current directory: $(pwd)"
    exit 1
fi

echo "1. Checking readiness status..."
echo "----------------------------------------"
if python3 agent_runtime/agno/main.py --readiness; then
    READY_STATUS=$?
else
    READY_STATUS=$?
fi

echo ""
echo "2. Current state summary..."
echo "----------------------------------------"
if python3 agent_runtime/agno/main.py --state 2>/dev/null; then
    echo ""
else
    echo "Failed to get state summary, falling back to raw JSON"
    if [[ -f "agent_runtime/state/STATE.json" ]]; then
        cat agent_runtime/state/STATE.json | jq '.' 2>/dev/null || cat agent_runtime/state/STATE.json
    else
        echo "STATE.json not found"
    fi
fi

echo ""
echo "3. Recent progress ledger..."
echo "----------------------------------------"
if [[ -f "agent_runtime/state/PROGRESS.md" ]]; then
    tail -n 10 agent_runtime/state/PROGRESS.md
else
    echo "PROGRESS.md not found"
fi

echo ""
echo "=== Bootstrap Complete ==="

# Exit with error code if readiness is RED (exit code 1)
if [[ $READY_STATUS -eq 1 ]]; then
    echo "WARNING: Readiness status is RED - please address issues before proceeding"
    exit 1
elif [[ $READY_STATUS -eq 0 ]]; then
    echo "SUCCESS: Readiness status is GREEN/YELLOW - ready for development"
    exit 0
else
    echo "UNKNOWN: Unexpected readiness status"
    exit $READY_STATUS
fi
