"""
State Manager for Agent Runtime - Phase 4C

Handles cross-session awareness by managing state persistence and progress tracking.
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Any, Optional


class StateManager:
    """Manages agent runtime state persistence and progress tracking."""

    def __init__(self, state_dir: str = "agent_runtime/state"):
        """
        Initialize StateManager.

        Args:
            state_dir: Path to the state directory
        """
        self.state_dir = Path(state_dir)
        self.state_file = self.state_dir / "STATE.json"
        self.progress_file = self.state_dir / "PROGRESS.md"
        self._ensure_state_files()

    def _ensure_state_files(self):
        """Ensure state files exist with proper initial content."""
        # Create state directory if it doesn't exist
        self.state_dir.mkdir(parents=True, exist_ok=True)
        
        # Create STATE.json if it doesn't exist
        if not self.state_file.exists():
            initial_state = {
                "phase": "4C",
                "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "last_session": None,
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": False,
                        "providers": []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                },
                "decisions": {
                    "when_to_use_contextstream": "When retrieving relevant historical context for planning",
                    "when_to_use_mcp": "When external tool access is required within risk boundaries",
                    "when_to_write_memory": "After successful task completion with sufficient evidence"
                }
            }
            self._write_state(initial_state)
        
        # Create PROGRESS.md if it doesn't exist
        if not self.progress_file.exists():
            with open(self.progress_file, 'w') as f:
                f.write("# Agent Runtime Progress Ledger\n\n")
                f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Session null: Phase 4C initialized [setup] -> success\n")

    def load_state(self) -> Dict[str, Any]:
        """
        Load current state from STATE.json.

        Returns:
            Current state dictionary
        """
        try:
            with open(self.state_file, 'r') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            # Return default state if file doesn't exist or is corrupted
            return {
                "phase": "4C",
                "last_updated": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "last_session": None,
                "features": {
                    "contextstream": {
                        "enabled": False,
                        "configured": False
                    },
                    "mcp": {
                        "enabled": False,
                        "providers": []
                    },
                    "memory_write": {
                        "enabled": False
                    }
                },
                "decisions": {
                    "when_to_use_contextstream": "When retrieving relevant historical context for planning",
                    "when_to_use_mcp": "When external tool access is required within risk boundaries",
                    "when_to_write_memory": "After successful task completion with sufficient evidence"
                }
            }

    def _write_state(self, state: Dict[str, Any]) -> None:
        """
        Write state to STATE.json.

        Args:
            state: State dictionary to write
        """
        with open(self.state_file, 'w') as f:
            json.dump(state, f, indent=2)

    def update_session_state(self, session_info: Dict[str, Any]) -> None:
        """
        Update state with session information.

        Args:
            session_info: Dictionary containing session information
        """
        state = self.load_state()
        state["last_updated"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        state["last_session"] = session_info
        
        # Update feature states based on session info
        if "features" in session_info:
            state["features"] = session_info["features"]
        
        # Update memory_write status if present
        if "memory_write" in session_info:
            state["memory_write"] = session_info["memory_write"]
            
        self._write_state(state)
        
        # Append to progress log
        self._append_progress_entry(session_info)

    def _append_progress_entry(self, session_info: Dict[str, Any]) -> None:
        """
        Append session entry to progress log.

        Args:
            session_info: Dictionary containing session information
        """
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        session_id = session_info.get("session_id", "unknown")
        task = session_info.get("task", "unknown task")
        mode = session_info.get("mode", "unknown")
        result = session_info.get("result", "unknown")
        
        entry = f"[{timestamp}] Session {session_id}: {task} [{mode}] -> {result}\n"
        
        with open(self.progress_file, 'a') as f:
            f.write(entry)

    def print_current_state(self) -> None:
        """Print a compact summary of the current state."""
        state = self.load_state()
        
        print("🔍 Agent Runtime State Summary:")
        print(f"  Phase: {state.get('phase', 'unknown')}")
        print(f"  Last Updated: {state.get('last_updated', 'never')}")
        
        last_session = state.get("last_session")
        if last_session:
            print(f"  Last Session: {last_session.get('session_id', 'none')} ({last_session.get('result', 'unknown')})")
        else:
            print("  Last Session: none")
            
        features = state.get("features", {})
        contextstream = features.get("contextstream", {})
        mcp = features.get("mcp", {})
        memory_write = features.get("memory_write", {})
        
        print(f"  ContextStream: {'enabled' if contextstream.get('enabled') else 'disabled'} ({'configured' if contextstream.get('configured') else 'not configured'})")
        print(f"  MCP: {'enabled' if mcp.get('enabled') else 'disabled'} ({len(mcp.get('providers', []))} providers)")
        print(f"  Memory Writing: {'enabled' if memory_write.get('enabled') else 'disabled'}")
        
        print()


# Convenience function
def get_state_manager() -> StateManager:
    """Get a configured StateManager instance."""
    return StateManager()
