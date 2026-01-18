## Phase 8A – Real Memory Persistence Implementation Spec

### Goal
Replace placeholder memory writes with deterministic, evidence-gated persistence, both local (disk) and remote (ContextStream). No production app code changes outside `agent_runtime/`.

### Exact Files to Change/Add

**New files:**
1. `agent_runtime/agno/memory_store.py` – Local persistence + remote coordination, redaction, retrieval.
2. `agent_runtime/memory/` directory – Created on first write, stores JSON memory records.
3. (Optional) `agent_runtime/agno/memory_index.json` – Simple index for fast queries.

**Modified files:**
1. `agent_runtime/agno/contextstream.py` – Replace placeholder `store` with real HTTP call; add env var validation (`CONTEXTSTREAM_URL`, `CONTEXTSTREAM_API_KEY`).
2. `agent_runtime/agno/main.py` – Update `await_memory_storage` to use `memory_store`; add local persistence fallback; extend `--write-memory` behavior.
3. `agent_runtime/agno/readiness.py` – Add “memory persistence readiness” check (directory writable, optional remote store config).
4. `agent_runtime/agno/state_manager.py` – Include memory_write status in `STATE.json`.
5. `agent_runtime/agno/evidence.py` – Add new event types: `memory_store_local`, `memory_store_remote`, `memory_store_error`.

### Data Format Examples

**Local memory record (JSON file per memory):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "pattern",
  "summary": "Successfully completed: Add unit tests for user service",
  "sources": ["agent_runtime/evidence/20260117_181512_b069d8ca_audit_complete.json"],
  "date": "2026-01-17T18:15:12.801505",
  "tags": ["testing", "unit", "agent-runtime"],
  "task": "Add unit tests for user service",
  "confidence": 0.95,
  "session_id": "b069d8ca",
  "risk_tier": "GREEN",
  "git_commit": "a109d56",
  "checksum": "sha256:abc123...",
  "store_location": "local",
  "remote_store_attempted": false,
  "remote_store_error": "not_configured"
}
```

**Remote store payload (ContextStream):**
```json
{
  "record": { ... same as above but with redacted secrets ... },
  "project": "neuronx"
}
```

**Memory index (simple query helper):**
```json
{
  "last_updated": "2026-01-17T18:15:12Z",
  "memory_count": 42,
  "by_tag": {
    "testing": ["mem_id1", "mem_id2"],
    "agent-runtime": ["mem_id3"]
  },
  "by_session": {
    "b069d8ca": ["mem_id1"]
  }
}
```

### Threat Model (Redaction + Safety)

**Secrets redaction:** Before any persistence (local or remote), scan the memory record's `summary` and `sources` fields for patterns:
- `*_KEY`, `*_TOKEN`, `*_SECRET`, `*_PASSWORD`
- `Authorization: Bearer`, `Bearer `
- `password=`, `api_key=`, `token=`
Replace matches with `[REDACTED:secret_type]`. Redaction must be deterministic across runs.

**Safety guarantees:**
- Write only after all governance gates pass (`--close-governance`, `--tdd‑proof`, evidence completeness).
- Atomic writes: write to temp file, then rename (prevents partial writes).
- Append‑only index; never delete memory files (immutable audit trail).
- Local directory permissions: `0o700` (owner‑only read/write).
- No PII extraction; redaction only for obvious secret patterns.

**Failure handling:**
- If local directory unwritable → readiness RED, block memory writes.
- If remote store fails → fall back to local + log “remote_store_error”.
- If redaction fails → block write entirely (fail‑safe).

### Acceptance Tests + Verification Commands

**Test 1 – Local persistence readiness**
```bash
python3 agent_runtime/agno/main.py --readiness
```
Expected: “Memory persistence: GREEN” (directory writable).

**Test 2 – Write memory (dry‑run)**
```bash
python3 agent_runtime/agno/main.py --write-memory --memory-type pattern --memory-tags "test" "Test memory storage" --dry-run
```
Expected: prints memory preview; no actual write.

**Test 3 – Real memory write (successful task)**
```bash
python3 agent_runtime/agno/main.py --write-memory --memory-type pattern --memory-tags "test" "Add a comment to calculateTotal" --close-governance na:read-only --tdd-proof na:docs-only
```
Expected:
- Creates `agent_runtime/memory/20260117_*.json`.
- Updates `STATE.json` last_session.memory_write status.
- Evidence logs `memory_store_local`.

**Test 4 – Retrieve last N memories**
```bash
python3 agent_runtime/agno/main.py --list-memories 5
```
(New flag) Outputs last 5 memory summaries.

**Test 5 – Remote store (if configured)**
Set `CONTEXTSTREAM_URL`, `CONTEXTSTREAM_API_KEY`, then run Test 3.
Expected: HTTP POST to configured URL; logs `memory_store_remote`.

### Rollback Plan

**If implementation breaks existing gates:**
1. **Disable memory writes:** Remove `--write-memory` flag handling (temporarily revert `await_memory_storage` to placeholder).
2. **Remove new module:** Delete `memory_store.py`, keep directory but ignore it.
3. **Revert readiness check:** Remove memory persistence readiness lines.
4. **Keep evidence files:** Already written memories remain; can be archived or ignored.

**Rollback steps:**
```bash
# 1. Remove memory_store import from main.py
# 2. Replace await_memory_storage with original placeholder
# 3. Remove memory_store.py
# 4. Revert readiness.py changes
```
All changes are isolated to `agent_runtime/`; no production app code affected.

### Implementation Steps

1. **Create `memory_store.py`** with:
   - `MemoryStore` class (local + remote coordination).
   - `redact_secrets(text)` function.
   - `store_memory(record, contextstream_client)` method.
   - `retrieve_memories(limit, tags)` method.
2. **Update `contextstream.py`**: Replace placeholder store with real `requests.post`. Add timeout, retry once, error handling.
3. **Update `main.py`**:
   - Import `MemoryStore`.
   - Modify `await_memory_storage` to use `MemoryStore.store_memory`.
   - Add `--list-memories` flag (optional, Phase 8B).
4. **Update `readiness.py`**: Add check for `agent_runtime/memory/` writable; remote store env vars optional.
5. **Update `evidence.py`**: Add event types.
6. **Update `state_manager.py`**: Add `memory_write` field.

### Constraints Satisfied
- Stay inside `agent_runtime/`.
- Preserve all existing gates (readiness, risk tiers, governance closure, TDD proof, evidence logging).
- No fabrication: retrieval reflects only persisted data.
- Deterministic + auditable writes (atomic rename, append‑only log).
- PII/secrets redaction minimum viable.

### Risks Mitigated
- **Data loss**: Atomic writes + temp‑file‑rename.
- **Secrets leakage**: Redaction before any persistence.
- **Performance**: Each memory ~1KB; 10k memories = 10MB.
- **Backwards compatibility**: Existing `--write-memory` behavior unchanged except now actually works.