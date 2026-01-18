# Cursor ↔ Ollama Cloud Integration (macOS)

A reliable FastAPI gateway that provides OpenAI-compatible access to Ollama models using exact model names (as shown in `ollama list`) while preserving Cursor's internal models and Tab/autocomplete functionality.

## Quick Start

### 1. Prerequisites

```bash
# Install Ollama if not already installed
brew install ollama

# Start Ollama
ollama serve

# Sign in to access cloud models
ollama signin

# Pull models
ollama pull nomic-embed-text:latest  # Local model
ollama pull gpt-oss:120b-cloud        # Cloud model
```

### 2. Setup Gateway

```bash
# Clone or download this repository
cd /path/to/gateway

# Install dependencies (virtual environment recommended)
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp env-example.txt .env
# Edit .env and set PROXY_API_KEY

# Start gateway
./run_gateway.sh
```

### 3. Configure Cursor

1. Open Cursor Settings → Models → Add Custom Model
2. Set:
   - **Base URL**: `http://127.0.0.1:4000/v1`
   - **API Key**: Your `PROXY_API_KEY` from .env
3. Add models using exact names like `nomic-embed-text:latest` or `gpt-oss:120b-cloud`

## Architecture

```
Cursor (preserves internal models)
    ↓ HTTP/1.1 + Bearer Auth
Ollama Gateway (FastAPI on :4000)
    ↓ HTTP/1.1
Ollama (localhost:11434)
    ↓
All Models (exact names from `ollama list`)
```

## Key Features

- ✅ **Preserves Cursor internals** - No global overrides
- ✅ **OpenAI-compatible** - Streaming + non-streaming support
- ✅ **Direct model access** - Uses exact Ollama model names
- ✅ **Secure** - API key authentication required
- ✅ **Mac-optimized** - Launchd service included
- ✅ **Privacy-focused** - Prompts not logged by default

## File Structure

```
├── main.py                 # FastAPI gateway server
├── requirements.txt        # Python dependencies
├── env-example.txt         # Environment template
├── run_gateway.sh          # Startup script
├── docs/
│   └── CURSOR_OLLAMA_MAC.md # Complete setup guide
└── mac-setup/
    ├── com.ollama.gateway.plist  # Launchd service
    └── README.md                 # Mac setup instructions
```

## API Endpoints

- `GET /healthz` - Health check
- `GET /readyz` - Readiness check (verifies Ollama)
- `GET /v1/models` - List available models
- `POST /v1/chat/completions` - Chat completions (streaming/non-streaming)

## Security

- Requires `Authorization: Bearer <PROXY_API_KEY>` header
- Only accepts localhost connections
- No prompt logging by default (`LOG_PROMPTS=false`)

## Troubleshooting

### Gateway won't start

```bash
# Check dependencies
source venv/bin/activate
pip install -r requirements.txt

# Check Ollama
curl http://localhost:11434/api/tags

# Check port 4000
lsof -i :4000
```

### Models not available

```bash
# List Ollama models
ollama list

# Check gateway logs
tail -f /tmp/ollama-gateway.err
```

### Cursor connection issues

- Verify API key matches between `.env` and Cursor settings
- Check gateway is running: `curl http://127.0.0.1:4000/healthz`
- Ensure no global OpenAI overrides in Cursor settings

## License

This project provides a bridge between Cursor and Ollama. Ensure compliance with respective service terms.
