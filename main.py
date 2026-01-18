#!/usr/bin/env python3
"""
OpenAI-compatible Ollama Gateway for Cursor Integration

This gateway provides OpenAI-compatible endpoints that route to Ollama models using exact model names as shown in `ollama list`.
"""

import os
import asyncio
import json
import time
from typing import Dict, List, Any, Optional, AsyncGenerator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
OLLAMA_BASE_URL = "http://localhost:11434"
GATEWAY_HOST = "127.0.0.1"
GATEWAY_PORT = 4000
PROXY_API_KEY = os.getenv("PROXY_API_KEY", "default-key-change-this")
LOG_PROMPTS = os.getenv("LOG_PROMPTS", "false").lower() == "true"

# Models
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatCompletionRequest(BaseModel):
    model: str
    messages: List[ChatMessage]
    stream: bool = False
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None

class ModelInfo(BaseModel):
    id: str
    object: str = "model"
    created: int
    owned_by: str = "ollama-gateway"

class ModelList(BaseModel):
    object: str = "list"
    data: List[ModelInfo]

# Global HTTP client
client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    client = httpx.AsyncClient(timeout=300.0)
    yield
    await client.aclose()

app = FastAPI(title="Ollama Gateway", lifespan=lifespan)

def check_api_key(request: Request):
    """Check API key authentication"""
    auth_header = request.headers.get("authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    token = auth_header[7:]  # Remove "Bearer "
    if token != PROXY_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

async def check_ollama_health() -> bool:
    """Check if Ollama is reachable"""
    try:
        response = await client.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=5.0)
        return response.status_code == 200
    except:
        return False

async def get_ollama_models() -> List[Dict[str, Any]]:
    """Get all models from Ollama"""
    try:
        response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
        if response.status_code == 200:
            data = response.json()
            return data.get("models", [])
        return []
    except:
        return []

@app.get("/healthz")
async def health_check():
    """Simple health check"""
    return {"status": "ok"}

@app.get("/readyz")
async def readiness_check():
    """Readiness check - verifies Ollama connectivity"""
    if await check_ollama_health():
        return {"status": "ready"}
    else:
        raise HTTPException(status_code=503, detail="Ollama not reachable")

@app.get("/v1/models")
async def list_models(request: Request):
    """List available models in OpenAI format"""
    check_api_key(request)

    models = []

    # Get all models from Ollama
    ollama_models = await get_ollama_models()
    for model in ollama_models:
        models.append(ModelInfo(
            id=model["name"],
            created=int(time.time())
        ))

    return ModelList(data=models)

async def stream_chat_completion(request_data: dict, ollama_model: str) -> AsyncGenerator[str, None]:
    """Stream chat completion from Ollama"""
    # Convert OpenAI format to Ollama format
    ollama_request = {
        "model": ollama_model,
        "messages": [
            {
                "role": msg["role"],
                "content": msg["content"]
            } for msg in request_data["messages"]
        ],
        "stream": True
    }

    # Add optional parameters
    if "temperature" in request_data and request_data["temperature"] is not None:
        ollama_request["options"] = {"temperature": request_data["temperature"]}

    if "max_tokens" in request_data and request_data["max_tokens"] is not None:
        if "options" not in ollama_request:
            ollama_request["options"] = {}
        ollama_request["options"]["num_predict"] = request_data["max_tokens"]

    try:
        async with client.stream(
            "POST",
            f"{OLLAMA_BASE_URL}/api/chat",
            json=ollama_request,
            timeout=300.0
        ) as response:
            if response.status_code != 200:
                error_text = await response.aread()
                yield f"data: {json.dumps({'error': {'message': f'Ollama error: {error_text.decode()}'}})}\n\n"
                return

            async for line in response.aiter_lines():
                if line.strip():
                    try:
                        ollama_chunk = json.loads(line)

                        # Convert Ollama format to OpenAI format
                        if "message" in ollama_chunk:
                            openai_chunk = {
                                "id": f"chatcmpl-{int(time.time())}",
                                "object": "chat.completion.chunk",
                                "created": int(time.time()),
                                "model": request_data["model"],
                                "choices": [{
                                    "index": 0,
                                    "delta": {
                                        "content": ollama_chunk["message"].get("content", "")
                                    },
                                    "finish_reason": None
                                }]
                            }

                            # Check if this is the final chunk
                            if ollama_chunk.get("done", False):
                                openai_chunk["choices"][0]["finish_reason"] = "stop"

                            yield f"data: {json.dumps(openai_chunk)}\n\n"

                        if ollama_chunk.get("done", False):
                            yield "data: [DONE]\n\n"
                            break

                    except json.JSONDecodeError:
                        continue

    except Exception as e:
        yield f"data: {json.dumps({'error': {'message': str(e)}})}\n\n"

async def non_stream_chat_completion(request_data: dict, ollama_model: str) -> Dict[str, Any]:
    """Non-streaming chat completion"""
    # Convert OpenAI format to Ollama format
    ollama_request = {
        "model": ollama_model,
        "messages": [
            {
                "role": msg["role"],
                "content": msg["content"]
            } for msg in request_data["messages"]
        ],
        "stream": False
    }

    # Add optional parameters
    if "temperature" in request_data and request_data["temperature"] is not None:
        ollama_request["options"] = {"temperature": request_data["temperature"]}

    if "max_tokens" in request_data and request_data["max_tokens"] is not None:
        if "options" not in ollama_request:
            ollama_request["options"] = {}
        ollama_request["options"]["num_predict"] = request_data["max_tokens"]

    try:
        response = await client.post(
            f"{OLLAMA_BASE_URL}/api/chat",
            json=ollama_request,
            timeout=300.0
        )

        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Ollama error: {response.text}")

        ollama_response = response.json()

        # Convert Ollama format to OpenAI format
        return {
            "id": f"chatcmpl-{int(time.time())}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": request_data["model"],
            "choices": [{
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": ollama_response.get("message", {}).get("content", "")
                },
                "finish_reason": "stop"
            }],
            "usage": {
                "prompt_tokens": ollama_response.get("prompt_eval_count", 0),
                "completion_tokens": ollama_response.get("eval_count", 0),
                "total_tokens": (ollama_response.get("prompt_eval_count", 0) +
                               ollama_response.get("eval_count", 0))
            }
        }

    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Request timeout")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/v1/chat/completions")
async def chat_completions(request: Request, request_data: Dict[str, Any]):
    """OpenAI-compatible chat completions endpoint"""
    check_api_key(request)

    if not LOG_PROMPTS:
        # Log only metadata, not the actual prompt
        print(f"[INFO] Chat completion request: model={request_data.get('model')}, "
              f"stream={request_data.get('stream', False)}, "
              f"messages_count={len(request_data.get('messages', []))}")

    # Use model name directly as provided
    ollama_model = request_data["model"]

    if request_data.get("stream", False):
        return StreamingResponse(
            stream_chat_completion(request_data, ollama_model),
            media_type="text/plain"
        )
    else:
        return await non_stream_chat_completion(request_data, ollama_model)

if __name__ == "__main__":
    print("Starting Ollama Gateway...")
    print(f"Gateway URL: http://{GATEWAY_HOST}:{GATEWAY_PORT}")
    print(f"Ollama URL: {OLLAMA_BASE_URL}")
    print(f"API Key required: {PROXY_API_KEY != 'default-key-change-this'}")
    print("Press Ctrl+C to stop")

    uvicorn.run(
        "main:app",
        host=GATEWAY_HOST,
        port=GATEWAY_PORT,
        reload=False,
        log_level="info"
    )