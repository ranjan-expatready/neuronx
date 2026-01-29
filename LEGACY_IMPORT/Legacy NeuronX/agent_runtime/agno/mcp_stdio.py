"""
MCP stdio runner - Phase 4B

Safely executes MCP server commands over stdio with timeouts, redaction,
and structured results. Intended for read-only MCP integrations.
"""

import json
import os
import subprocess
import time
from typing import Any, Dict, List, Optional


REDACT_KEYS = {"GITHUB_TOKEN", "CONTEXTSTREAM_API_KEY", "MCP_API_KEY", "MCP_TLS_CERT", "MCP_SERVER_HOST", "MCP_SERVER_PORT"}


def _redact(text: str, env: Dict[str, str]) -> str:
    if not text:
        return text
    redacted = text
    for key in REDACT_KEYS:
        val = env.get(key)
        if val and isinstance(val, str) and val:
            redacted = redacted.replace(val, "[redacted]")
    return redacted


def run_stdio_command(command: List[str], payload: Dict[str, Any], env: Optional[Dict[str, str]] = None, timeout_seconds: int = 30) -> Dict[str, Any]:
    start = time.time()
    env_safe = env.copy() if env else os.environ.copy()

    try:
        proc = subprocess.run(
            command,
            input=json.dumps(payload, sort_keys=True),
            capture_output=True,
            text=True,
            timeout=timeout_seconds,
            env=env_safe,
        )
    except FileNotFoundError:
        elapsed = int((time.time() - start) * 1000)
        return {"ok": False, "data": None, "error": f"Command not found: {command[0] if command else '[missing]'}", "meta": {"elapsed_ms": elapsed, "exit_code": -1}}
    except subprocess.TimeoutExpired:
        elapsed = int((time.time() - start) * 1000)
        return {"ok": False, "data": None, "error": "MCP command timed out", "meta": {"elapsed_ms": elapsed, "exit_code": -1}}
    except Exception as exc:  # noqa: BLE001
        elapsed = int((time.time() - start) * 1000)
        return {"ok": False, "data": None, "error": f"MCP command failed: {exc}"[:400], "meta": {"elapsed_ms": elapsed, "exit_code": -1}}

    elapsed = int((time.time() - start) * 1000)

    stdout = _redact(proc.stdout or "", env_safe)
    stderr = _redact(proc.stderr or "", env_safe)

    meta = {
        "elapsed_ms": elapsed,
        "exit_code": proc.returncode,
        "stdout_len": len(stdout),
        "stderr_len": len(stderr),
    }

    if proc.returncode != 0:
        meta["stderr_preview"] = stderr[:800]
        return {"ok": False, "data": None, "error": stderr.strip() or "MCP command failed", "meta": meta}

    try:
        data = json.loads(stdout) if stdout else None
    except json.JSONDecodeError:
        meta["stdout_preview"] = stdout[:800]
        return {"ok": False, "data": None, "error": "Invalid MCP response (non-JSON)", "meta": meta}

    return {"ok": True, "data": data, "error": None, "meta": meta}
