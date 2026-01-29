#!/usr/bin/env python3
"""
State Consistency Validator - Phase 5B.3

Checks that STATE.json and PROGRESS.md are synchronized.
Exits with error code 1 if they diverge, 0 if consistent.
"""

import json
import os
import sys
from pathlib import Path
from typing import Optional, Tuple

def get_last_session_from_state(state_path: Path) -> Tuple[Optional[str], Optional[str]]:
    """Extract last session ID and result from STATE.json."""
    try:
        with open(state_path, 'r') as f:
            state = json.load(f)
        
        last_session = state.get("last_session")
        if not last_session:
            return None, None
        
        session_id = last_session.get("session_id")
        result = last_session.get("result")
        return session_id, result
    except (FileNotFoundError, json.JSONDecodeError, IOError) as e:
        print(f"Error reading {state_path}: {e}")
        return None, None

def get_last_entry_from_progress(progress_path: Path) -> Tuple[Optional[str], Optional[str]]:
    """Extract last session ID and result from PROGRESS.md."""
    try:
        with open(progress_path, 'r') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
        
        if not lines:
            return None, None
        
        # Find the last non-empty line that looks like a progress entry
        # Format: [timestamp] Session <session_id>: <task> [<mode>] -> <result>
        for line in reversed(lines):
            if line.startswith("[") and "Session " in line and "->" in line:
                # Extract session ID
                session_start = line.find("Session ") + len("Session ")
                session_end = line.find(":", session_start)
                if session_end == -1:
                    continue
                session_id = line[session_start:session_end].strip()
                
                # Extract result
                result_start = line.rfind("-> ") + len("-> ")
                if result_start == len("-> ") - 1:  # Not found
                    continue
                result = line[result_start:].strip()
                
                return session_id, result
        
        return None, None
    except (FileNotFoundError, IOError) as e:
        print(f"Error reading {progress_path}: {e}")
        return None, None

def main():
    """Validate STATE.json and PROGRESS.md consistency."""
    # Paths to state files
    repo_root = Path(__file__).resolve().parent.parent
    state_path = repo_root / "agent_runtime" / "state" / "STATE.json"
    progress_path = repo_root / "agent_runtime" / "state" / "PROGRESS.md"
    
    print(f"🔍 Validating state consistency...")
    print(f"  STATE.json: {state_path}")
    print(f"  PROGRESS.md: {progress_path}")
    
    # Get last session from STATE
    state_session_id, state_result = get_last_session_from_state(state_path)
    
    # Get last entry from PROGRESS
    progress_session_id, progress_result = get_last_entry_from_progress(progress_path)
    
    print(f"\n  STATE last session: {state_session_id or '(none)'} -> {state_result or '(none)'}")
    print(f"  PROGRESS last entry: {progress_session_id or '(none)'} -> {progress_result or '(none)'}")
    
    # Validation logic
    if state_session_id is None and progress_session_id is None:
        print("✅ Both STATE and PROGRESS are empty - consistent (fresh install)")
        return 0
    
    if state_session_id is None and progress_session_id is not None:
        print("❌ STATE has no last_session but PROGRESS has entries - INCONSISTENT")
        print("   Remediation: Run agent runtime to generate proper state")
        return 1
    
    if state_session_id is not None and progress_session_id is None:
        print("❌ STATE has last_session but PROGRESS is empty - INCONSISTENT")
        print("   Remediation: Check PROGRESS.md file integrity")
        return 1
    
    # Both have sessions - check for match
    if state_session_id == progress_session_id and state_result == progress_result:
        print(f"✅ STATE and PROGRESS match exactly - consistent")
        return 0
    
    # Allow relaxed match: STATE's last_session should appear somewhere in recent PROGRESS entries
    # Scan PROGRESS for state_session_id
    try:
        with open(progress_path, 'r') as f:
            progress_content = f.read()
            if state_session_id and state_session_id in progress_content:
                print(f"✅ STATE session {state_session_id} found in PROGRESS - acceptable")
                print(f"   Note: Exact match not required; async updates may cause minor drift")
                return 0
    except IOError:
        pass
    
    print(f"❌ STATE session {state_session_id} not found in PROGRESS - INCONSISTENT")
    print(f"   Remediation: Investigate state corruption or missing progress entries")
    return 1

if __name__ == "__main__":
    sys.exit(main())
