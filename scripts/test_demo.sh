#!/bin/bash

# Test the demo script execution

set -e

echo "Testing NeuronX Demo Script..."
echo "=============================="

# Check if demo script exists
if [ ! -f "scripts/demo/run_demo.sh" ]; then
    echo "❌ Demo script not found"
    exit 1
fi

# Check if demo helpers exist
if [ ! -f "scripts/demo/demo_helpers.sh" ]; then
    echo "❌ Demo helpers not found"
    exit 1
fi

# Check if fixture exists
if [ ! -f "test/fixtures/neuronx/demo_lead_payload.json" ]; then
    echo "❌ Demo fixture not found"
    exit 1
fi

# Test script syntax
if bash -n scripts/demo/run_demo.sh; then
    echo "✅ Demo script syntax valid"
else
    echo "❌ Demo script syntax invalid"
    exit 1
fi

if bash -n scripts/demo/demo_helpers.sh; then
    echo "✅ Demo helpers syntax valid"
else
    echo "❌ Demo helpers syntax invalid"
    exit 1
fi

# Test fixture JSON validity
if command -v jq >/dev/null 2>&1; then
    if jq empty test/fixtures/neuronx/demo_lead_payload.json >/dev/null 2>&1; then
        echo "✅ Demo fixture JSON valid"
    else
        echo "❌ Demo fixture JSON invalid"
        exit 1
    fi
else
    echo "⚠️  jq not available, skipping JSON validation"
fi

echo "✅ All demo tests passed"
echo "Demo script ready for execution"


