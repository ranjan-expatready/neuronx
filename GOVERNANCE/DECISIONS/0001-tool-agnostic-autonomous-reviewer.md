# ADR-0001: Tool-Agnostic Autonomous Reviewer

**Status**: Accepted
**Date**: 2026-02-04
**Author**: Antigravity (CTO)
**Supersedes**: None
**Superseded By**: None

---

## Context

The Autonomous Engineering OS originally used a tool-specific reviewer ("Trae") as a mandatory check for T1-T4 changes. This created several issues:

1. **Tool Coupling**: The CI/CD pipeline was hardcoded to require Trae-specific artifacts
2. **Vendor Lock-in**: Changing review tools required modifying multiple workflow files
3. **IDE Dependency**: Trae was tied to a specific IDE (Trae IDE), limiting flexibility
4. **Artifact Location**: Review artifacts were stored in `TRAE_REVIEW/` instead of generic `VERIFICATION/`

---

## Decision

Replace all tool-specific reviewer references with a **tool-agnostic "Autonomous Reviewer" role**.

Key changes:
1. Create `autonomous-reviewer.yml` workflow that accepts verification artifacts from any qualified source
2. Deprecate (but preserve) `trae-review-validator.yml` for backwards compatibility
3. Use `COCKPIT/artifacts/VERIFICATION/` as the canonical location for review artifacts
4. Accept legacy `TRAE_REVIEW/` artifacts for backwards compatibility
5. Update CLAUDE.md Section J to define the Autonomous Reviewer pattern
6. Normalize all documentation to use "Autonomous Reviewer" terminology

---

## Consequences

### Positive

- **Flexibility**: Any qualified reviewer (QA Droid, Security Droid, Claude, etc.) can provide verification
- **No Vendor Lock-in**: Review tooling can change without modifying core workflows
- **Cleaner Artifacts**: Verification artifacts have a standard location and format
- **Better Documentation**: CLAUDE.md now clearly defines the reviewer role

### Negative

- **Migration Overhead**: Existing documentation needed updates (60+ files with Trae references)
- **Backwards Compatibility**: Must continue accepting legacy TRAE_REVIEW artifacts
- **Learning Curve**: Contributors need to understand the new pattern

### Neutral

- **Workflow Count**: Same number of workflows (autonomous-reviewer replaces trae-review as primary)
- **Review Quality**: Review quality depends on the reviewer, not the tooling

---

## Alternatives Considered

### Alternative 1: Keep Trae as Primary

- **Description**: Continue using Trae as the mandatory reviewer
- **Pros**: No migration needed, existing workflows work
- **Cons**: Tool lock-in, IDE dependency, inflexible
- **Why Not**: Limits future evolution of the review system

### Alternative 2: Remove Review Gate Entirely

- **Description**: Rely only on CI tests and Machine Board
- **Pros**: Simpler workflow, faster merges
- **Cons**: Loses adversarial review capability, reduces safety
- **Why Not**: Review gate is essential for T1/T2 changes

---

## Implementation

1. **PR #15** (Merged 2026-02-04):
   - Created `autonomous-reviewer.yml`
   - Deprecated `trae-review-validator.yml`
   - Updated `CLAUDE.md` with Section J
   - Created `.factory/config.json`
   - Updated `STATUS_LEDGER.md`

2. **Follow-up PR** (Pending):
   - Fix remaining Trae references in `machine-board.yml`
   - Fix remaining Trae references in `ANTIGRAVITY_SYSTEM_PROMPT.md`
   - Create ADR system (this document)

---

## References

- PR #15: Tool-Agnostic Autonomous Reviewer Normalization
- CLAUDE.md Section J: Reviewer & Tool Agnosticism
- STATE/STATUS_LEDGER.md v1.8: Normalization audit trail
