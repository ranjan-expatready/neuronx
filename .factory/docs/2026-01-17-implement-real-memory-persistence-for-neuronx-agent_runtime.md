## Overview
Implement real memory persistence for NeuronX agent_runtime with local storage and optional remote (ContextStream) backup. Replace placeholder memory storage with deterministic, audit‑safe persistence that respects existing governance gates.

## Scope
- **Only touch** files in `agent_runtime/agno/` (plus `agent_runtime/memory/` directory creation)
- **No new runtime dependencies** – use `urllib.request` for HTTP if needed
- **Preserve all existing gates** (readiness, risk tiers, governance closure, TDD proof, evidence logging)
- **Deterministic operation** – no fabricated data, fail‑safe redaction of secrets

## Implementation Plan

### 1. Create `agent_runtime/agno/memory_store.py`
- **MemoryStore** class with:
  - `store_memory(record, contextstream_client=None)` – writes locally (atomic), optionally remote
  - `retrieve_memories(limit=5, tags=None)` – reads from local JSONL index
  - `redact_secrets(text)` – deterministic pattern matching (`*_KEY`, `*_TOKEN`, `Authorization: Bearer`, `password=`, `api_key=`, `token=`) → `[REDACTED:<type>]`
- **Local persistence**:
  - Directory: `agent_runtime/memory/`
  - Permissions: `0o700` (ensure on creation)
  - Atomic write: temp file → rename
  - Append‑only index: `agent_runtime/memory/INDEX.jsonl`
- **Remote persistence**:
  - If `CONTEXTSTREAM_URL` + `CONTEXTSTREAM_API_KEY` exist and client configured, attempt POST with `urllib.request`
  - One retry on network failure; fallback to local + evidence event `remote_store_error`

### 2. Update Readiness Check (`readiness.py`)
- Add check `Memory Directory Writable`:
  - Verify `agent_runtime/memory/` exists and is writable (permissions `0o700`)
  - If unwritable → readiness **RED** and block memory writes
  - If env vars missing → note `remote not configured` (does not affect readiness color)
- Update `collect_readiness` return dict with new check

### 3. Modify CLI (`main.py`)
- **Replace `await_memory_storage`**:
  - Use `MemoryStore` instead of direct ContextStream call
  - Only store after **all gates pass** (`--close‑governance`, `--tdd‑proof`, evidence completeness)
  - `--dry‑run` must show preview and write nothing
- **Add `--list‑memories N`**:
  - Calls `MemoryStore.retrieve_memories(limit=N)`
  - Prints formatted summaries (timestamp, type, tags, first line of summary)
- Update `--write‑memory` flag to actually store after success

### 4. Update State and Evidence
- **State (`STATE.json`)**:
  - Add `memory_write` status in `last_session`: `enabled/attempted/success/failure` + counts
  - Update `features.memory_write.enabled` based on readiness
- **Evidence events**:
  - Add `memory_store_local`, `memory_store_remote`, `memory_store_blocked`, `remote_store_error`, `memory_list`
  - Log in evidence session (use existing `EvidenceLogger`)

### 5. Acceptance Tests (to run after implementation)
1. `python3 agent_runtime/agno/main.py --readiness` → memory readiness shows GREEN when dir writable
2. `python3 agent_runtime/agno/main.py --write‑memory --memory‑type pattern --memory‑tags "test" "Test memory storage" --dry‑run` → preview only, no file created
3. `python3 agent_runtime/agno/main.py --write‑memory --memory‑type pattern --memory‑tags "test" "Test memory storage write" --close‑governance na:read‑only --tdd‑proof na:docs‑only` → creates `agent_runtime/memory/<timestamp>_*.json`, appends `INDEX.jsonl`, logs evidence, updates `STATE.json`
4. `python3 agent_runtime/agno/main.py --list‑memories 5` → prints last 5 stored memories

### 6. Deliverables
- `git diff --stat` showing changes limited to `agent_runtime/`
- Output of acceptance commands (captured as evidence)
- No breaking changes to existing functionality (all gates remain enforced)

## Architectural Constraints
- **No business logic outside agent_runtime** – memory store is a pure persistence layer
- **Secrets redaction** must be deterministic and fail‑safe (block write if redaction fails)
- **Atomic writes** guarantee no partial/corrupt memory files
- **Append‑only index** ensures audit trail cannot be silently deleted

## Risk Assessment
- **Low risk**: only additive changes within existing `agent_runtime/` boundary
- **No new dependencies** – uses stdlib only
- **All existing gates preserved** – memory writes still require governance closure and TDD proof