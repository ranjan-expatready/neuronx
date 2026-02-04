# ADR-0002: Factory Execution Seal

**Status**: Accepted
**Date**: 2026-02-04
**Author**: Antigravity (CTO)
**Supersedes**: None
**Superseded By**: None

---

## Context

The Factory execution infrastructure existed as a Phase 1 mock implementation:

1. **Mock Script**: `dispatch_factory.py` created branches and PRs but did NOT call Factory Cloud API
2. **Untracked Files**: `dispatcher.yml` and `dispatch_factory.py` were not committed to main
3. **No API Integration**: No real Factory Cloud execution was triggered
4. **Missing Validation**: No SDLC phase validation before dispatch

This left the autonomous execution capability incomplete and unsealed.

---

## Decision

Seal Factory execution by implementing real API integration with explicit safety gates.

Key changes:
1. **Configure FACTORY_API_KEY** secret in GitHub repository
2. **Upgrade dispatch_factory.py** (v2.0) with real Factory Cloud API integration
3. **Add SDLC phase validation** before dispatch (check for PLAN artifact reference or override label)
4. **Enforce PR-only execution mode** (`execution_mode: "pr_only"`) - Factory never pushes to main
5. **Add workflow SDLC validation step** in dispatcher.yml
6. **Commit files to main** via governance-gated PR
7. **Subject all Factory PRs** to machine-board and autonomous-reviewer gates

---

## Consequences

### Positive

- **Sealed Execution**: Factory can now execute autonomously when triggered
- **Explicit Gating**: Execution only happens via `ready-for-factory` label (human action)
- **SDLC Enforcement**: Validation ensures proper planning before implementation
- **Safety First**: PR-only mode prevents any direct pushes to main
- **Governance Preserved**: All Factory PRs pass machine-board + autonomous-reviewer
- **Audit Trail**: Execution records created in COCKPIT/artifacts/EXECUTION/

### Negative

- **API Dependency**: Relies on Factory Cloud API availability
- **Secret Management**: FACTORY_API_KEY must be rotated periodically

### Neutral

- **Label-Based Trigger**: Human must apply label to initiate execution
- **Same Governance**: Factory PRs follow same rules as manual PRs

---

## Alternatives Considered

### Alternative 1: Keep Mock Implementation

- **Description**: Continue using Phase 1 mock (no real API)
- **Pros**: No API dependency, simpler
- **Cons**: Not actually autonomous, no real execution
- **Why Not**: Defeats purpose of autonomous execution

### Alternative 2: Direct Push (No PR)

- **Description**: Allow Factory to push directly to main
- **Pros**: Faster execution
- **Cons**: Bypasses all governance, extremely unsafe
- **Why Not**: Violates core governance principles

### Alternative 3: Automatic Trigger (No Label)

- **Description**: Trigger on issue creation, not labeling
- **Pros**: More automated
- **Cons**: No human oversight, could execute unwanted work
- **Why Not**: Label provides explicit human intent

---

## Implementation

**PR**: feat/factory-execution-seal

**Files Changed**:
1. `FACTORY_API_KEY` (GitHub secret) - Created
2. `.github/workflows/dispatcher.yml` - Committed with SDLC validation
3. `scripts/dispatch_factory.py` - Upgraded to v2.0 with real API
4. `STATE/STATUS_LEDGER.md` - Updated (v1.10)
5. `GOVERNANCE/DECISIONS/0002-factory-execution-seal.md` - Created (this file)

---

## Safety Verification

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| No push to main | `execution_mode: "pr_only"` | ENFORCED |
| Human trigger | `ready-for-factory` label required | ENFORCED |
| SDLC validation | Workflow step + script check | ENFORCED |
| Governance gates | machine-board + autonomous-reviewer | ENFORCED |
| Audit trail | COCKPIT/artifacts/EXECUTION/ records | ENFORCED |

---

## References

- ADR-0001: Tool-Agnostic Autonomous Reviewer
- GOVERNANCE/GUARDRAILS.md: Safety rules
- .factory/config.json: Factory configuration (model: claude-opus)
- CLAUDE.md Section H: Critical rules (delegate via Factory)
