"""
Evidence Logger - Audit Trail and Evidence Collection

Simple file-based evidence logging system for agent runtime execution.
Logs all actions, decisions, and results for audit and debugging purposes.
"""

import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from uuid import uuid4

class EvidenceLogger:
    """
    Evidence logger for agent runtime execution.

    Creates timestamped evidence files in agent_runtime/evidence/ directory
    with complete audit trails of all operations.
    """

    def __init__(self, evidence_dir: Optional[str] = None):
        """
        Initialize the evidence logger.

        Args:
            evidence_dir: Directory to store evidence files (default: ../evidence/)
        """
        if evidence_dir is None:
            # Default to agent_runtime/evidence/
            self.evidence_dir = Path(__file__).parent.parent / "evidence"
        else:
            self.evidence_dir = Path(evidence_dir)

        # Create evidence directory if it doesn't exist
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

        self.current_session_id: Optional[str] = None
        self.session_start_time: Optional[datetime] = None

    def start_session(self, task_description: str, config: Optional[Dict[str, Any]] = None) -> str:
        """
        Start a new evidence session.

        Args:
            task_description: Description of the task being executed
            config: Optional session configuration data

        Returns:
            Session ID for this execution
        """
        self.current_session_id = str(uuid4())[:8]
        self.session_start_time = datetime.now()

        session_data = {
            "session_id": self.current_session_id,
            "task_description": task_description,
            "start_time": self.session_start_time.isoformat(),
            "status": "started"
        }

        if config:
            session_data["config"] = config

        self._write_evidence_file("session_start", session_data)
        return self.current_session_id

    def log_event(self, event_type: str, event_data: Dict[str, Any]) -> str:
        """
        Log an event with evidence data.

        Args:
            event_type: Type of event (e.g., "risk_classification", "execution_complete")
            event_data: Dictionary containing event details

        Returns:
            Filename of the evidence file created
        """
        if self.current_session_id is None:
            raise RuntimeError("No active session. Call start_session() first.")

        event_record = {
            "session_id": self.current_session_id,
            "timestamp": datetime.now().isoformat(),
            "event_type": event_type,
            "event_data": event_data
        }

        return self._write_evidence_file(event_type, event_record)

    def log_mcp_call(self, provider: str, action: str, ok: bool, error: Optional[str], meta: Dict[str, Any], params_redacted: Dict[str, Any]) -> str:
        """Log an MCP call without exposing sensitive parameters."""
        return self.log_event(
            "mcp_call",
            {
                "provider": provider,
                "action": action,
                "ok": ok,
                "error": error,
                "meta": meta or {},
                "params_hash": self._stable_hash(params_redacted or {}),
                "params_keys": sorted(list((params_redacted or {}).keys())),
            },
        )

    def end_session(self, final_status: str = "completed", summary: Optional[Dict[str, Any]] = None):
        """
        End the current evidence session.

        Args:
            final_status: Final status of the session
            summary: Optional summary data
        """
        if self.current_session_id is None:
            return

        end_time = datetime.now()
        duration = None
        if self.session_start_time:
            duration = (end_time - self.session_start_time).total_seconds()

        session_end_data = {
            "session_id": self.current_session_id,
            "end_time": end_time.isoformat(),
            "duration_seconds": duration,
            "final_status": final_status,
            "summary": summary or {}
        }

        self._write_evidence_file("session_end", session_end_data)

        # Reset session state
        self.current_session_id = None
        self.session_start_time = None

    def _write_evidence_file(self, event_type: str, data: Dict[str, Any]) -> str:
        """
        Write evidence data to a timestamped file.

        Args:
            event_type: Type of event for filename
            data: Evidence data to write

        Returns:
            Filename of the created evidence file
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        session_prefix = f"{self.current_session_id}_" if self.current_session_id else ""

        filename = f"{timestamp}_{session_prefix}{event_type}.json"
        filepath = self.evidence_dir / filename

        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        except Exception as e:
            # Fallback: write to stderr if file writing fails
            print(f"Evidence logging failed: {e}", file=sys.stderr)
            print(f"Evidence data: {data}", file=sys.stderr)

        return filename

    def capture_git_diff_stat(self) -> str:
        """
        Capture git diff --stat for current repository state.

        Returns:
            Evidence filename of the captured git diff
        """
        from toolrunner import SafeToolRunner

        tools = SafeToolRunner()

        # Capture git diff stat
        exit_code, stdout, stderr = tools.execute_command("git_diff")

        diff_data = {
            "command": "git diff --stat",
            "exit_code": exit_code,
            "stdout": stdout,
            "stderr": stderr,
            "timestamp": datetime.now().isoformat()
        }

        return self.log_event("git_diff_capture", diff_data)

    def capture_test_summary(self, test_commands_run: list[str]) -> str:
        """
        Capture summary of test commands that were executed.

        Args:
            test_commands_run: List of test command names that were attempted

        Returns:
            Evidence filename of the test summary
        """
        test_summary = {
            "test_commands_attempted": test_commands_run,
            "test_commands_available": ["pnpm_test_unit", "pnpm_lint", "pnpm_typecheck"],
            "timestamp": datetime.now().isoformat()
        }

        return self.log_event("test_summary_capture", test_summary)

    def get_session_evidence_files(self, session_id: str) -> list[str]:
        """
        Get all evidence files for a specific session.

        Args:
            session_id: Session ID to search for

        Returns:
            List of evidence filenames for the session
        """
        pattern = f"*{session_id}_*.json"
        return [f.name for f in self.evidence_dir.glob(pattern)]

    def get_recent_evidence_files(self, limit: int = 10) -> list[str]:
        """
        Get the most recent evidence files.

        Args:
            limit: Maximum number of files to return

        Returns:
            List of recent evidence filenames (newest first)
        """
        files = list(self.evidence_dir.glob("*.json"))
        files.sort(key=lambda f: f.stat().st_mtime, reverse=True)
        return [f.name for f in files[:limit]]

    @staticmethod
    def _stable_hash(data: Any) -> str:
        try:
            payload = json.dumps(data, sort_keys=True, separators=(",", ":"))
        except Exception:
            payload = str(data)
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:16]

# Convenience functions
def create_evidence_logger(evidence_dir: Optional[str] = None) -> EvidenceLogger:
    """Create and return a configured EvidenceLogger instance."""
    return EvidenceLogger(evidence_dir)

def log_task_evidence(task: str, evidence_data: Dict[str, Any]) -> str:
    """Convenience function to log evidence for a task."""
    logger = EvidenceLogger()
    return logger.log_event("task_evidence", {
        "task": task,
        **evidence_data
    })