"""
GitHub MCP Provider (Read-Only) - Phase 4B.1

Provides a guarded adapter to a GitHub MCP stdio server with strict
read-only action enforcement and graceful noop fallback when the server
is unavailable or misconfigured.
"""

import os
import shutil
from pathlib import Path
from typing import Any, Dict, List, Optional

from mcp_stdio import run_stdio_command


class GitHubMCPProvider:
    """Read-only GitHub MCP provider routed through the MCP bridge."""

    READ_ONLY_ACTIONS = {
        "list_issues",
        "get_issue",
        "list_prs",
        "get_pr",
        "get_checks",
        "get_ci_status",
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        raw_command = self.config.get("command")
        self.command: List[str] = raw_command if isinstance(raw_command, list) else []
        self.server_mode = (
            os.environ.get("MCP_GITHUB_SERVER")
            or self.config.get("serverMode")
            or "stdio"
        ).lower()
        self.default_repo = (
            os.environ.get("GITHUB_REPO")
            or self.config.get("repository")
            or "owner/repo"
        )

    def call(self, action: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a read-only GitHub MCP action.

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
            response["error"] = "GitHub MCP noop mode: server not available"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False)
            return response

        if not self.command:
            response["error"] = "No github MCP command configured"
            response["meta"] = self._base_meta(normalized_action, params, server_available=False, command_available=False)
            return response

        token = os.environ.get("GITHUB_TOKEN")
        if not token:
            response["error"] = "GITHUB_TOKEN not set"
            response["meta"] = self._base_meta(normalized_action, params, server_available=True, token_present=False)
            return response

        meta = self._base_meta(normalized_action, params, server_available=True, command=self.command)

        if not self.command:
            response["error"] = "GitHub MCP command is empty"
            response["meta"] = meta
            return response

        cmd0 = self.command[0]
        cmd_available = Path(cmd0).is_absolute() and Path(cmd0).exists() or shutil.which(cmd0) is not None
        meta["command_available"] = cmd_available
        if not cmd_available:
            response["error"] = f"GitHub MCP command not found: {cmd0}"
            response["meta"] = meta
            return response

        env = os.environ.copy()
        env["GITHUB_TOKEN"] = token
        env.setdefault("GITHUB_REPO", self.default_repo)

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
    ) -> Dict[str, Any]:
        return {
            "provider": "github",
            "action": action,
            "server_mode": self.server_mode,
            "server_available": server_available,
            "token_present": token_present,
            "command_configured": bool(self.command),
            "command": command[0] if command else None,
            "repository": os.environ.get("GITHUB_REPO") or self.default_repo,
            "params_keys": sorted(list((params or {}).keys())),
        }
