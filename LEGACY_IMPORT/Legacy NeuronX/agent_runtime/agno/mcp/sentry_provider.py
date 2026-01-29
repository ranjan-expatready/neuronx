"""
Sentry MCP Provider - Phase 4B

Provides a guarded adapter to the Sentry MCP server.
"""

import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp_stdio import run_stdio_command


class SentryMCPProvider:
    """Sentry MCP provider routed through the MCP bridge."""

    ALLOWED_ACTIONS = {
        "list_issues",
        "get_issue",
        "list_events",
        "get_event",
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        raw_command = self.config.get("command")
        self.command: List[str] = raw_command if isinstance(raw_command, list) else []
        self.server_mode = (
            self.config.get("serverMode") or "stdio"
        ).lower()

    def call(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a Sentry MCP action.
        """

        normalized_action = (action or "").strip()
        response = {"ok": False, "data": None, "error": None, "meta": {}}

        if normalized_action not in self.ALLOWED_ACTIONS:
            response["error"] = f"Action {normalized_action or '[missing]'} not supported"
            response["meta"] = self._base_meta(normalized_action, params)
            return response

        if self.server_mode == "noop":
            response["error"] = "Sentry MCP noop mode: server not available"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False)
            return response

        if not self.command:
            response["error"] = "No Sentry MCP command configured"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False, command_available=False)
            return response

        # Check for Auth Token (SENTRY_AUTH_TOKEN)
        token = os.environ.get("SENTRY_AUTH_TOKEN")
        if not token:
            response["error"] = "SENTRY_AUTH_TOKEN not set"
            response["meta"] = self._base_meta(normalized_action, params, server_available=True, token_present=False)
            return response

        cmd0 = self.command[0]
        cmd_available = Path(cmd0).is_absolute() and Path(cmd0).exists() or shutil.which(cmd0) is not None
        
        meta = self._base_meta(normalized_action, params, server_available=True, command=self.command, token_present=True)
        meta["command_available"] = cmd_available
        
        if not cmd_available:
            response["error"] = f"Sentry MCP command not found: {cmd0}"
            response["meta"] = meta
            return response

        env = os.environ.copy()
        env["SENTRY_AUTH_TOKEN"] = token

        timeout = int(self.config.get("timeout_seconds", 30))
        result = run_stdio_command(self.command, {"action": normalized_action, "params": params or {}}, env=env, timeout_seconds=timeout)

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
        token_present: bool = True,
        command: Optional[list[str]] = None,
        command_available: bool = True,
    ) -> Dict[str, Any]:
        return {
            "provider": "sentry",
            "action": action,
            "server_mode": self.server_mode,
            "server_available": server_available,
            "token_present": token_present,
            "command_configured": bool(self.command),
            "command": command[0] if command else None,
            "command_available": command_available,
            "params_keys": sorted(list((params or {}).keys())),
        }
