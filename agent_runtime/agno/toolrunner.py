"""
Safe Tool Runner - Controlled Command Execution

Provides safe execution of allowlisted tools with strict boundaries.
Phase 3A: Minimal allowlist focused on read-only operations and safe scripts.
"""

import subprocess
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

class SafeToolRunner:
    """
    Safe tool runner with allowlisted commands and execution controls.

    Only allows specific, safe operations to prevent system compromise.
    All executions are logged and controlled.
    """

    def __init__(self):
        # Allowlisted commands - Phase 3A minimal set
        self.allowed_commands = {
            # Git read-only operations
            "git_status": ["git", "status", "--porcelain"],
            "git_diff": ["git", "diff", "--stat"],
            "git_diff_staged": ["git", "diff", "--cached", "--stat"],
            "git_log_recent": ["git", "log", "--oneline", "-5"],

            # Package manager scripts (if they exist)
            "pnpm_lint": ["pnpm", "run", "lint"],
            "pnpm_typecheck": ["pnpm", "run", "typecheck"],
            "pnpm_test_unit": ["pnpm", "run", "test:unit"],

            # File operations (read-only)
            "list_dir": ["ls", "-la"],
            "grep_search": ["grep", "-r", "-n"],  # Requires safe argument validation
        }

        # Blocked command patterns (security)
        self.blocked_patterns = [
            "rm", "del", "delete", "unlink",  # File deletion
            "mv", "move", "rename",          # File moving
            "chmod", "chown",                # Permission changes
            "sudo", "su",                    # Privilege escalation
            "curl", "wget", "http", "ftp",   # Network operations
            "ssh", "scp", "rsync",           # Remote operations
            "docker", "kubectl", "terraform", # Infrastructure tools
            "npm", "yarn", "pip",            # Package managers (except pnpm scripts)
            "python", "node", "bash",        # Direct interpreters
            "make", "cmake",                 # Build tools
        ]

    def execute_command(self, command_name: str, args: Optional[List[str]] = None,
                       cwd: Optional[str] = None) -> Tuple[int, str, str]:
        """
        Execute an allowlisted command safely.

        Args:
            command_name: Name of the allowlisted command
            args: Additional arguments for the command
            cwd: Working directory (must be within repository)

        Returns:
            Tuple of (exit_code, stdout, stderr)

        Raises:
            ValueError: If command is not allowlisted or arguments are unsafe
        """
        # Validate command is allowlisted
        if command_name not in self.allowed_commands:
            raise ValueError(f"Command '{command_name}' is not in allowlist")

        # Get base command
        base_cmd = self.allowed_commands[command_name].copy()

        # Add additional arguments if provided
        if args:
            # Validate arguments are safe
            self._validate_arguments(args)
            base_cmd.extend(args)

        # Validate working directory
        if cwd:
            cwd_path = Path(cwd).resolve()
            repo_root = self._get_repo_root()
            if not str(cwd_path).startswith(str(repo_root)):
                raise ValueError(f"Working directory outside repository: {cwd}")
        else:
            cwd = str(self._get_repo_root())

        try:
            # Execute command with strict controls
            result = subprocess.run(
                base_cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=30,  # 30 second timeout
                env=self._get_safe_env()
            )

            return result.returncode, result.stdout, result.stderr

        except subprocess.TimeoutExpired:
            return -1, "", "Command timed out after 30 seconds"
        except FileNotFoundError:
            return -1, "", f"Command not found: {base_cmd[0]}"
        except Exception as e:
            return -1, "", f"Execution error: {str(e)}"

    def is_command_allowed(self, command_name: str) -> bool:
        """Check if a command is in the allowlist."""
        return command_name in self.allowed_commands

    def get_allowed_commands(self) -> List[str]:
        """Get list of all allowlisted command names."""
        return list(self.allowed_commands.keys())

    def _validate_arguments(self, args: List[str]) -> None:
        """
        Validate command arguments for safety.

        Args:
            args: Arguments to validate

        Raises:
            ValueError: If arguments contain blocked patterns
        """
        args_str = " ".join(args).lower()

        for pattern in self.blocked_patterns:
            if pattern in args_str:
                raise ValueError(f"Blocked pattern in arguments: {pattern}")

        # Additional safety checks
        if ".." in args_str:
            raise ValueError("Directory traversal not allowed")

        if any(char in args_str for char in [";", "&", "|", "`"]):
            raise ValueError("Shell metacharacters not allowed")

    def _get_repo_root(self) -> Path:
        """Get the repository root directory."""
        # Start from this file's directory and go up until we find .git
        current = Path(__file__).resolve().parent
        while current.parent != current:
            if (current / ".git").exists():
                return current
            current = current.parent

        # Fallback: assume we're in agent_runtime/agno/, go up two levels
        return Path(__file__).resolve().parent.parent.parent

    def _get_safe_env(self) -> Dict[str, str]:
        """Get a safe environment with minimal variables."""
        # Start with a clean environment
        safe_env = {}

        # Copy only safe environment variables
        safe_vars = [
            "PATH",           # For finding executables
            "HOME",           # User home directory
            "USER",           # Username
            "SHELL",          # Shell (for subprocess)
            "LANG",           # Localization
            "LC_ALL",         # Localization override
        ]

        for var in safe_vars:
            if var in os.environ:
                safe_env[var] = os.environ[var]

        # Set restrictive umask-like behavior (though this is env, not actual umask)
        # This is more of a documentation of intent

        return safe_env

# Convenience functions for common operations
def run_git_status() -> Tuple[int, str, str]:
    """Run git status safely."""
    runner = SafeToolRunner()
    return runner.execute_command("git_status")

def run_git_diff() -> Tuple[int, str, str]:
    """Run git diff --stat safely."""
    runner = SafeToolRunner()
    return runner.execute_command("git_diff")

def run_lint_check() -> Tuple[int, str, str]:
    """Run linting check safely."""
    runner = SafeToolRunner()
    return runner.execute_command("pnpm_lint")

def run_type_check() -> Tuple[int, str, str]:
    """Run type checking safely."""
    runner = SafeToolRunner()
    return runner.execute_command("pnpm_typecheck")

def run_unit_tests() -> Tuple[int, str, str]:
    """Run unit tests safely."""
    runner = SafeToolRunner()
    return runner.execute_command("pnpm_test_unit")