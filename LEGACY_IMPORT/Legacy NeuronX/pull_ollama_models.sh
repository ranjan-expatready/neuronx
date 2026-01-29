#!/bin/bash

# Ollama Cloud Model Pull Script
# Tries :cloud, -cloud, then :latest for each model

MODELS=(
    "nemotron-3-nano:30b"
    "gemini-3-flash-preview"
    "gemini-3-pro-preview"
    "devstral-small-2:24b"
    "devstral-2:123b"
    "ministral-3:3b"
    "ministral-3:8b"
    "ministral-3:14b"
    "qwen3-vl:8b"
    "qwen3-vl:30b"
    "qwen3-vl:235b"
    "gpt-oss:20b"
    "gpt-oss:120b"
    "qwen3-coder:30b"
    "qwen3-coder:480b"
    "gemma3:4b"
    "gemma3:12b"
    "gemma3:27b"
    "deepseek-v3.1:671b"
    "deepseek-v3.2"
    "qwen3-next:80b"
    "glm-4.6"
    "glm-4.7"
    "minimax-m2"
    "minimax-m2.1"
    "cogito-2.1:671b"
    "rnj-1:8b"
    "kimi-k2"
    "kimi-k2-thinking"
    "mistral-large-3"
)

SUCCESSFUL_PULLS=()
FAILED_PULLS=()

echo "🔄 Starting Ollama Cloud model pulls..."
echo "=========================================="

for model in "${MODELS[@]}"; do
    echo ""
    echo "📦 Trying to pull: $model"

    # Try :cloud first
    if ollama pull "${model}:cloud" 2>/dev/null; then
        echo "✅ SUCCESS: ${model}:cloud"
        SUCCESSFUL_PULLS+=("${model}:cloud")
        continue
    fi

    # Try -cloud
    if ollama pull "${model}-cloud" 2>/dev/null; then
        echo "✅ SUCCESS: ${model}-cloud"
        SUCCESSFUL_PULLS+=("${model}-cloud")
        continue
    fi

    # Try :latest as fallback
    if ollama pull "${model}:latest" 2>/dev/null; then
        echo "✅ SUCCESS: ${model}:latest"
        SUCCESSFUL_PULLS+=("${model}:latest")
        continue
    fi

    # All attempts failed
    echo "❌ FAILED: $model (tried :cloud, -cloud, :latest)"
    FAILED_PULLS+=("$model")
done

echo ""
echo "📊 SUMMARY"
echo "=========="
echo "✅ Successful pulls: ${#SUCCESSFUL_PULLS[@]}"
for model in "${SUCCESSFUL_PULLS[@]}"; do
    echo "   - $model"
done

echo ""
echo "❌ Failed pulls: ${#FAILED_PULLS[@]}"
for model in "${FAILED_PULLS[@]}"; do
    echo "   - $model"
done

echo ""
echo "💡 Note: Failed models may not exist or require different tags."
echo "   You can try: ollama pull <model-name> manually to see available tags."