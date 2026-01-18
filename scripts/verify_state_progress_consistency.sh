#!/usr/bin/env bash
# Phase 5B.3: State/Progress Consistency Guard
# Verifies that the last session ID in STATE.json appears in the recent PROGRESS.md
# Exit codes: 0 = consistent, 1 = inconsistent

set -euo pipefail

STATE_FILE="agent_runtime/state/STATE.json"
PROGRESS_FILE="agent_runtime/state/PROGRESS.md"

# Check if files exist
if [[ ! -f "$STATE_FILE" ]]; then
    echo "FAIL: STATE.json missing at $STATE_FILE"
    echo "Remediation: Run 'python3 agent_runtime/agno/main.py --state' to generate state"
    exit 1
fi

if [[ ! -f "$PROGRESS_FILE" ]]; then
    echo "FAIL: PROGRESS.md missing at $PROGRESS_FILE"
    echo "Remediation: Run 'python3 agent_runtime/agno/main.py --state' to generate progress ledger"
    exit 1
fi

# Extract last_session.session_id from STATE.json using Python (stdlib only)
SESSION_ID=$(python3 -c "
import json, sys
try:
    data = json.load(open('$STATE_FILE'))
    session_id = data['last_session']['session_id']
    print(session_id)
except Exception as e:
    sys.stderr.write(f'ERROR reading STATE.json: {e}\\n')
    sys.exit(1)
")

if [[ -z "$SESSION_ID" ]]; then
    echo "FAIL: Could not extract session_id from STATE.json"
    exit 1
fi

# Check if session ID appears in last 50 lines of PROGRESS.md
if tail -n 50 "$PROGRESS_FILE" | grep -q "Session $SESSION_ID:"; then
    echo "PASS: Session $SESSION_ID found in recent progress ledger"
    exit 0
else
    echo "FAIL: Session $SESSION_ID NOT found in last 50 lines of PROGRESS.md"
    echo ""
    echo "Remediation steps:"
    echo "1. Check if STATE.json was updated without corresponding PROGRESS.md entry"
    echo "2. Run 'python3 agent_runtime/agno/main.py --state' to synchronize state and progress"
    echo "3. If the session was recent, verify PROGRESS.md contains:"
    echo "   [timestamp] Session $SESSION_ID: ..."
    echo "4. If mismatch persists, consider manual audit of state/progress consistency"
    exit 1
fi
