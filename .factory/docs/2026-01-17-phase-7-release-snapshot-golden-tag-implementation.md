## Phase 7: Release Snapshot + Golden Tag Implementation Plan

### Objective
Create a frozen, auditable "known-good" baseline for the NeuronX governed runtime covering Phases 4C–6, anchored with a single immutable golden tag.

### Deliverables
1. **Directory**: `releases/v1.0-governed-runtime/`
2. **SNAPSHOT.md** (~40 lines human-readable summary):
   - Date: 2026-01-17
   - Git commit SHA: `6f782a2`
   - Included phases: 4C (Production Hardening), 5 (Factory Integration), 6 (CI-Level Enforcement)
   - Explicit guarantees (bullet points covering governance, quality gates, SSOT)
   - Explicit OUT-OF-SCOPE section (no Phase 8, no automation, no enforcement logic)
3. **MANIFEST.json** (machine-readable):
   - `commit`: `6f782a2`
   - `tracked_files`: Array of 30+ governance file paths (see list below)
4. **CHECKSUMS.txt**:
   - SHA256 checksums for each file listed in MANIFEST.json
   - Static output only

### Governance Files to Include in MANIFEST
- `AGENTS.md`
- `FACTORY_PLAYBOOK.md`
- `docs/SSOT/01_MISSION.md`
- `docs/SSOT/02_GOVERNANCE.md`
- `docs/SSOT/03_QUALITY_BAR.md`
- `docs/SSOT/04_TEST_STRATEGY.md`
- `docs/SSOT/05_CI_CD.md`
- `docs/SSOT/06_RELEASES_AND_TAGS.md`
- `docs/SSOT/07_PROGRESS_LEDGER.md`
- `docs/SSOT/08_EPICS_INDEX.md`
- `docs/SSOT/09_EVIDENCE_INDEX.md`
- `docs/SSOT/10_AGENT_MEMORY.md`
- `docs/SSOT/11_GITHUB_GOVERNANCE.md`
- `docs/SSOT/20M_TRANSFORMATION_PLAN.md`
- `.cursor/rules/00_operating_mode.mdc`
- `.cursor/rules/10_code_style.mdc`
- `.cursor/rules/20_pr_quality_bar.mdc`
- `.cursor/rules/30_testing_contract.mdc`
- `.cursor/rules/40_security_basics.mdc`
- `.cursor/rules/50_no_drift_policy.mdc`
- `.cursor/rules/60_vendor_boundary_policy.mdc`
- `.cursor/rules/70_adapter_architecture.mdc`
- `.cursor/rules/80_integration_safety.mdc`
- `.cursor/rules/85_evidence_capture.mdc`
- `.cursor/rules/SSOT_BOOTSTRAP.mdc`
- `.factory/hooks/neuronx_session_start.sh`
- `.factory/settings.json`
- `.factory/docs/2026-01-17-phase-6-ci-level-enforcement-for-state-consistency-governance-closure-tdd-proof-.md`
- `agent_runtime/state/STATE.json`
- `agent_runtime/state/PROGRESS.md`
- `scripts/validate-state-consistency.py`
- `scripts/verify_state_progress_consistency.sh`
- `scripts/validate-agent-memory.ts`
- `scripts/validate-evidence.ts`

### Implementation Steps
1. Create directory `releases/v1.0-governed-runtime/`
2. Write SNAPSHOT.md with bullet-point guarantees and out-of-scope section
3. Generate MANIFEST.json with commit SHA and tracked file paths
4. Compute SHA256 checksums for each tracked file and write CHECKSUMS.txt
5. Verify git status clean (only new snapshot files)
6. Commit all new files with message "Phase 7: Release Snapshot + Golden Tag (Phases 4C–6)"
7. Create annotated tag `golden-v1.0` with message "NeuronX governed runtime v1.0 (Phases 4–6 complete)"
8. Confirm tag created and immutable

### Constraints Respected
- No production or agent runtime logic modifications
- No new CI rules, scripts, or automation
- No refactoring of existing governance files
- No additional versioning schemes beyond single tag
- Changes limited to new files under `/releases/` and one git tag
- One commit + one tag only

### Acceptance Criteria
- One commit containing ONLY release snapshot files
- One immutable annotated tag
- Zero behavior change
- Zero new dependencies
- Zero governance drift

After implementation, stop—no follow-up phases or enhancements proposed.