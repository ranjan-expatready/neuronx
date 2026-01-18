# Phase 6 Specification: CI-Level Enforcement for NeuronX

## Overview
Add CI-level enforcement for four critical quality areas without production code changes, using GitHub Actions only. All changes are reversible and align with AGENTS.md and SSOT.

## Enforcement Areas

### 1. State/Progress Consistency
**Problem**: STATE.json and PROGRESS.md can drift, breaking agent memory consistency.
**Solution**: Integrate existing `scripts/verify_state_progress_consistency.sh` into CI.
**Implementation**:
- Add step `Validate state/progress consistency` in `ci.yml` and `pr-quality-checks.yml`
- Run script; fail if inconsistent
- **Reversible**: Step can be removed or skipped via `ENFORCE_STATE_CONSISTENCY=false`

### 2. Governance Closure
**Problem**: PR governance checklist may be incomplete or unchecked.
**Solution**: Validate that all required SSOT Compliance checkboxes are checked (or justified).
**Implementation**:
- Create `scripts/validate-governance-closure.ts` that:
  - Fetches PR body via GitHub API
  - Parses SSOT Compliance section
  - Validates each required checkbox is `- [x]` or marked `N/A` with comment
  - Optionally checks that referenced files (TRACEABILITY.md, ENGINEERING_LOG.md) are modified
- Integrate into `pr-quality-checks.yml` and `pr-template-validation.yml`
- **Reversible**: Step can be removed or skipped via `ENFORCE_GOVERNANCE_CLOSURE=false`

### 3. TDD Proof
**Problem**: New source code may lack corresponding tests, violating TDD.
**Solution**: Ensure each new/modified source file has a corresponding test file.
**Implementation**:
- Create `scripts/validate-tdd-proof.ts` that:
  - Uses `git diff` to identify new/modified `.ts` files (excluding test files)
  - For each source file, checks for a corresponding `.spec.ts` file in appropriate `__tests__` directory
  - Fails if missing
- Integrate into `ci.yml` and `pr-quality-checks.yml`
- **Reversible**: Step can be removed or skipped via `ENFORCE_TDD_PROOF=false`

### 4. PR Quality Gates
**Problem**: PR descriptions may lack essential sections (risks, rollback plan, verification).
**Solution**: Extend existing PR template validation with additional checks.
**Implementation**:
- Enhance `pr-template-validation.yml` to validate:
  - PR description length > 100 characters
  - "Risks" section not empty
  - "Rollback Plan" section not empty
  - "How Verified" checkboxes are checked
  - UI changes include screenshot references
- **Reversible**: Checks can be disabled via `ENFORCE_PR_QUALITY=false`

## Reversibility & Configuration
All new validation steps include environment variable toggles:
- `PHASE6_ENFORCEMENT=false` disables all Phase 6 checks
- Individual toggles per area (as above)
- Default: enabled (`true`)

## Acceptance Criteria
1. ✅ State/progress consistency validation integrated into CI and PR quality checks; fails when STATE.json and PROGRESS.md inconsistent.
2. ✅ Governance closure validation ensures all required SSOT Compliance checkboxes are checked (or justified); fails if missing.
3. ✅ TDD proof validation ensures new source files have corresponding test files; fails if missing.
4. ✅ PR quality gates validation includes checks for PR description completeness, risks, rollback plan, and verification checkboxes.
5. ✅ All new validation steps are reversible via environment variables.
6. ✅ Changes limited to GitHub Actions configuration files (`ci.yml`, `pr-quality-checks.yml`, `pr-template-validation.yml`) and validation scripts in `scripts/`; no production code changes.
7. ✅ Validation scripts follow existing patterns (TypeScript/Python, error handling, logging).
8. ✅ SSOT documentation (`docs/SSOT/05_CI_CD.md`, `docs/SSOT/11_GITHUB_GOVERNANCE.md`) updated to reflect new enforcement.

## Alignment with AGENTS.md & SSOT
- References AGENTS.md No-Drift Policy (state consistency)
- Follows SSOT/03_QUALITY_BAR.md Definition of Done
- Respects SSOT/11_GITHUB_GOVERNANCE.md PR requirements
- Ensures evidence-gated claims (validation scripts produce evidence)

## Implementation Order
1. Create validation scripts (`validate-governance-closure.ts`, `validate-tdd-proof.ts`)
2. Update CI workflows (`ci.yml`, `pr-quality-checks.yml`, `pr-template-validation.yml`)
3. Add environment variables for reversibility
4. Test with sample PRs
5. Update SSOT documentation

## Risk Mitigation
- All validations can be disabled immediately via environment variables
- Failures provide clear remediation steps
- Scripts are idempotent and non‑destructive
- No changes to application logic or runtime behavior