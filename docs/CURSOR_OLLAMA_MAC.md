# Cursor ↔ Ollama Cloud Integration Setup (macOS)

This guide sets up a reliable Cursor integration with Ollama that preserves Cursor's internal models while adding access to local and cloud Ollama models.

## Architecture Overview

```
Cursor (preserves internal models)
    ↓
Ollama Gateway (http://127.0.0.1:4000)
    ↓
Ollama (localhost:11434)
    ↓
All Models (exact names from `ollama list`)
```

**Key Benefits:**

- ✅ Cursor internal models remain untouched (no global overrides)
- ✅ Tab/autocomplete stays with Cursor's models
- ✅ Access to all Ollama models using exact names
- ✅ Secure API key authentication
- ✅ Streaming support
- ✅ Direct model name mapping

## Prerequisites

### 1. Ollama Installation & Setup

Ensure Ollama is installed and configured:

```bash
# Check installation
ollama --version

# Sign in to Ollama Cloud (required for cloud models)
ollama signin

# Verify running
curl http://localhost:11434/api/tags
```

### 2. Pull Required Models

```bash
# Pull a local coding model (choose one)
ollama pull qwen2.5-coder:7b        # Recommended for coding
# OR
ollama pull codellama:7b-code       # Alternative

# Pull cloud models (these will be available using exact names)
ollama pull qwen3-coder:480b-cloud  # Large coding model
ollama pull gpt-oss:120b-cloud      # General purpose
ollama pull deepseek-v3.1:671b-cloud # Large reasoning model
```

## Gateway Setup

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy and edit the environment file
cp env-example.txt .env
# Edit .env and set a secure PROXY_API_KEY
```

Example `.env`:

```bash
PROXY_API_KEY=your-secure-random-key-here
LOG_PROMPTS=false
```

### 3. Start the Gateway

**Option A: Manual Start**

```bash
python main.py
```

**Option B: Auto-start on Login (Recommended)**

```bash
# Edit paths in the plist
sed -i '' 's|/path/to/your/gateway|/Users/YOUR_USERNAME/Desktop/NeuronX|g' mac-setup/com.ollama.gateway.plist

# Install service
cp mac-setup/com.ollama.gateway.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.ollama.gateway.plist

# Check status
launchctl list | grep ollama
```

## Cursor Configuration

### Important: Keep Cursor Internal Models

**DO NOT** enable "Override OpenAI Base URL" globally in Cursor settings. This would break Cursor's internal models including Tab/autocomplete.

### Add Ollama as Additional Provider

1. **Open Cursor Settings** → **Models** → **Add Custom Model**

2. **Provider Settings:**
   - **Provider Name**: `Ollama Gateway`
   - **Base URL**: `http://127.0.0.1:4000/v1`
   - **API Key**: `your-secure-random-key-here` (from .env file)

3. **Model Configuration:**
   - **Model Name**: Choose from available models (see below)
   - **Context Window**: `128000` (adjust based on model)
   - **Enable Streaming**: ✅ Checked

### Available Models

After setup, all models from `ollama list` will be available using their exact names:

- `nomic-embed-text:latest` - Local embedding model
- `llama3:latest` - Local general purpose model
- `qwen2.5-coder:7b` - Local 7B coding model (if pulled)
- `codellama:7b-code` - Local coding model (if pulled)
- `qwen3-coder:480b-cloud` - Large cloud coding model
- `gpt-oss:120b-cloud` - General purpose cloud model
- `deepseek-v3.1:671b-cloud` - Large reasoning cloud model
- `glm-4.7:cloud` - GLM 4.7B cloud model
- `deepseek-v3.2:cloud` - DeepSeek v3.2 cloud model

**Use exact names from `ollama list` - no prefixes needed!**

## Model Selection in Cursor

When using Ollama models in Cursor:

1. **Open chat** or use **Composer**
2. **Select model** from the dropdown - look for your custom Ollama Gateway models
3. **Tab completion** will still use Cursor's internal models (preserved)

## Verification

### Quick Verification

```bash
# 1. Models should match `ollama list`
curl -H "Authorization: Bearer YOUR_API_KEY" http://127.0.0.1:4000/v1/models

# 2. Test chat completion with gpt-oss:120b-cloud
curl -X POST \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-oss:120b-cloud","messages":[{"role":"user","content":"Say hello in one word"}]}' \
     http://127.0.0.1:4000/v1/chat/completions
```

### Detailed Verification

#### 1. Check Gateway Health

```bash
# Health check
curl http://127.0.0.1:4000/healthz

# Readiness check (verifies Ollama connection)
curl http://127.0.0.1:4000/readyz
```

#### 2. List Available Models

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     http://127.0.0.1:4000/v1/models
```

#### 3. Test Chat Completion

```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "model": "gpt-oss:120b-cloud",
       "messages": [{"role": "user", "content": "Say hello in one word"}],
       "stream": false
     }' \
     http://127.0.0.1:4000/v1/chat/completions
```

Expected response:

```json
{
  "id": "chatcmpl-...",
  "object": "chat.completion",
  "model": "gpt-oss:120b-cloud",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Hello"
      }
    }
  ]
}
```

### 4. Test in Cursor

1. Open a new chat in Cursor
2. Select an Ollama model from the model dropdown
3. Send a message - you should get a response
4. Try Tab completion - it should still work with Cursor's internal models

## Troubleshooting

### Gateway Won't Start

- Check if port 4000 is available: `lsof -i :4000`
- Verify `.env` file exists with `PROXY_API_KEY`
- Check logs: `tail -f /tmp/ollama-gateway.err`

### Models Not Available

- Ensure Ollama is running: `ollama list`
- Check gateway logs for model loading errors
- Restart the gateway after pulling new models

### Authentication Errors

- Verify `PROXY_API_KEY` in `.env` matches Cursor settings
- Check for typos in the Authorization header

### Cursor Not Connecting

- Confirm gateway is running: `curl http://127.0.0.1:4000/healthz`
- Check Cursor's custom model configuration
- Verify no firewall blocking localhost connections

### Tab Autocomplete Broken

- This should not happen with this setup
- If it does, you may have accidentally enabled global OpenAI override
- Go to Cursor Settings → Models and disable any global overrides

## Security Notes

- The gateway requires authentication via `PROXY_API_KEY`
- Prompts are not logged by default (`LOG_PROMPTS=false`)
- Only metadata (model, latency, status) is logged
- Gateway only accepts connections from localhost (127.0.0.1)

## Performance Tips

- Local models are faster than cloud models
- Cloud models require internet connection
- Use appropriate model sizes for your hardware
- Gateway has 5-minute timeout for requests

## Updating

To update the gateway:

```bash
# Pull latest changes
git pull

# Update dependencies
pip install -r requirements.txt

# Restart service
launchctl unload ~/Library/LaunchAgents/com.ollama.gateway.plist
launchctl load ~/Library/LaunchAgents/com.ollama.gateway.plist
```

## Uninstall

```bash
# Stop and remove service
launchctl unload ~/Library/LaunchAgents/com.ollama.gateway.plist
rm ~/Library/LaunchAgents/com.ollama.gateway.plist

# Remove files
rm -rf /path/to/gateway/directory
```
