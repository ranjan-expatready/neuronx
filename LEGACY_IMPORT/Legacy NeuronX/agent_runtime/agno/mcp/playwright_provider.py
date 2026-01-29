"""
Playwright MCP Provider - Phase 4B

Provides a guarded adapter to the Playwright MCP server.
"""

import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp_stdio import run_stdio_command


class PlaywrightMCPProvider:
    """Playwright MCP provider routed through the MCP bridge."""

    ALLOWED_ACTIONS = {
        "navigate",
        "click",
        "type_text",
        "take_screenshot",
        "get_text",
        "wait_for_element",
        "execute_script",
        "get_page_info",
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
        Execute a Playwright MCP action.
        """

        normalized_action = (action or "").strip()
        response = {"ok": False, "data": None, "error": None, "meta": {}}

        if normalized_action not in self.ALLOWED_ACTIONS:
            response["error"] = f"Action {normalized_action or '[missing]'} not supported"
            response["meta"] = self._base_meta(normalized_action, params)
            return response

        if self.server_mode == "noop":
            response["error"] = "Playwright MCP noop mode: server not available"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False)
            return response

        if not self.command:
            response["error"] = "No Playwright MCP command configured"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False, command_available=False)
            return response

        cmd0 = self.command[0]
        cmd_available = Path(cmd0).is_absolute() and Path(cmd0).exists() or shutil.which(cmd0) is not None
        
        meta = self._base_meta(normalized_action, params, server_available=True, command=self.command)
        meta["command_available"] = cmd_available
        
        if not cmd_available:
            response["error"] = f"Playwright MCP command not found: {cmd0}"
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
        command_available: bool = True,
    ) -> Dict[str, Any]:
        return {
            "provider": "playwright",
            "action": action,
            "server_mode": self.server_mode,
            "server_available": server_available,
            "command_configured": bool(self.command),
            "command": command[0] if command else None,
            "command_available": command_available,
            "params_keys": sorted(list((params or {}).keys())),
        }
