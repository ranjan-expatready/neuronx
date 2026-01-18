# Agent Runtime State Management (Phase 4C)

## Purpose

Cross-session awareness for the agent runtime to track:
- What phases are completed
- Which tool layers are enabled (ContextStream / MCP / etc.)
- What should be used when (decisioning)
- Progress tracking to avoid drift across sessions

## Files

1. `STATE.json` - Machine-readable canonical snapshot
2. `PROGRESS.md` - Human-readable ledger (append-only)
3. `README.md` - This file

## STATE.json Schema

```json
{
  "phase": "string",                    // Current phase (e.g., "4C")
  "last_updated": "ISO timestamp",      // When state was last modified
  "last_session": {                     // Most recent session summary
    "session_id": "string",             // Session identifier
    "task": "string",                   // Task description
    "mode": "string",                   // Execution mode (normal/mcp-only/etc.)
    "result": "string",                 // Outcome (success/failure/blocked)
    "features": {
      "contextstream": {
        "enabled": "boolean",           // Whether ContextStream is enabled
        "configured": "boolean"         // Whether ContextStream is properly configured
      },
      "mcp": {
        "enabled": "boolean",           // Whether MCP is enabled
        "providers_count": "number"     // Number of enabled MCP providers
      },
      "memory_write": {
        "enabled": "boolean"            // Whether memory writing is enabled
      }
    }
  },
  "features": {
    "contextstream": {
      "enabled": "boolean",             // Current ContextStream enabled state
      "configured": "boolean"           // Current ContextStream configuration state
    },
    "mcp": {
      "enabled": "boolean",             // Current MCP enabled state
      "providers": ["string"]          // List of enabled MCP providers
    },
    "memory_write": {
      "enabled": "boolean"              // Current memory writing state
    }
  },
  "decisions": {
    "when_to_use_contextstream": "string",  // Decision guidance
    "when_to_use_mcp": "string",            // Decision guidance
    "when_to_write_memory": "string"       // Decision guidance
  }
}
```

## PROGRESS.md Format

Each entry follows this format:
```
[YYYY-MM-DD HH:MM:SS] Session {session_id}: {task} [{mode}] -> {result}
```

## Usage

The state management system is integrated into `agent_runtime/agno/main.py`:
- On program start: load STATE.json and print compact summary
- On program end: update STATE.json and append entry to PROGRESS.md
- Works for both normal execution and MCP-only path
