"""
Context7 MCP Provider (Read-Only) - Library and Documentation Lookup

Provides a guarded adapter to Upstash Context7 MCP stdio server with strict
read-only action enforcement and graceful noop fallback when the server
is unavailable or misconfigured.
"""

import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp_stdio import run_stdio_command


class Context7MCPProvider:
    """Read-only Context7 MCP provider routed through the MCP bridge."""

    READ_ONLY_ACTIONS = {
        "search",
        "get",
        "list",
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        raw_command = self.config.get("command")
        self.command: List[str] = raw_command if isinstance(raw_command, list) else []
        self.server_mode = (
            os.environ.get("MCP_CONTEXT7_SERVER")
            or self.config.get("serverMode")
            or "stdio"
        ).lower()

    def call(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a read-only Context7 MCP action.

        Returns a structured response with ok/data/error/meta and never
        raises to the caller; failures are expressed in-band.
        """

        normalized_action = (action or "").strip()
        response = {"ok": False, "data": None, "error": None, "meta": {}}

        if normalized_action not in self.READ_ONLY_ACTIONS:
            response["error"] = f"Action {normalized_action or '[missing]'} not supported"
            response["meta"] = self._base_meta(normalized_action, params)
            return response

        # noop mode explicit or implied by missing command
        if self.server_mode == "noop":
            response["error"] = "Context7 MCP noop mode: server not available"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False)
            return response

        if not self.command:
            response["error"] = "No Context7 MCP command configured"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False, command_available=False)
            return response

        meta = self._base_meta(normalized_action, params, server_available=True, command=self.command)

        if not self.command:
            response["error"] = "Context7 MCP command is empty"
            response["meta"] = meta
            return response

        cmd0 = self.command[0]
        cmd_available = Path(cmd0).is_absolute() and Path(cmd0).exists() or shutil.which(cmd0) is not None
        meta["command_available"] = cmd_available
        if not cmd_available:
            response["error"] = f"Context7 MCP command not found: {cmd0}"
            response["meta"] = meta
            return response

        timeout = int(self.config.get("timeout_seconds", 30))
        result = run_stdio_command(self.command, {"action": normalized_action, "params": params or {}}, timeout_seconds=timeout)

        meta.update(result.get("meta", {}))
        response["ok"] = bool(result.get("ok"))
        response["data"] = result.get("data")
        response["error"] = result.get("error")
        response["meta"] = meta
        return response

    def _base_meta(
        self,
        action: str,
        params: Dict[str, Any],
        server_available: bool = True,
        command: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        return {
            "provider": "context7",
            "action": action,
            "server_mode": self.server_mode,
            "server_available": server_available,
            "command_configured": bool(self.command),
            "command": command[0] if command else None,
            "params_keys": sorted(list((params or {}).keys())),
        }
