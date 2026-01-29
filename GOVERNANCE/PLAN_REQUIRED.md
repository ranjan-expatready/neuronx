# PLAN-Required Governance Definition (T1)

## PLAN

### Objective
Formalize PLAN-required governance with required fields and validation tests to harden safe autonomy

### Non-Goals
This does not modify Trae review requirements or security enforcement - only PLAN structure validation

### Files
- GOVERNANCE/PLAN_REQUIRED.md (this document)
- FRAMEWORK/EVIDENCE_INDEX.md (test evidence documentation)
- COCKPIT/artifacts/TRAE_REVIEW/TRAE-20260129-35.yml

### Risk Tier
T1

### Rollback
- Revert commit e21bf70 if critical issues found
- Remove test evidence entries from EVIDENCE_INDEX.md
- Close PR without merge if validation fails

---

## PLAN-Required Governance

Version: v1.0
Owner: Antigravity (CTO)
Ratified By: Founder
Status: CANONICAL

---

## Purpose

This document defines the PLAN-required governance for Autonomous Engineering OS. All T1/T2 or protected path changes MUST include a complete PLAN header in the PR description.

---

## Required PLAN Fields

For T1/T2 or protected path PRs, the following fields are REQUIRED in the PR description:

| Field | Purpose | Example |
|-------|---------|---------|
| **Objective** | What this PR achieves | Add user authentication |
| **Non-Goals** | What this PR does NOT do | UI design, payment processing |
| **Files** | Files being changed | auth.py, users.py, test_auth.py |
| **Risk Tier** | T0-T4 classification | T1 (Critical) |
| **Rollback** | How to revert if needed | Revert commit abc123 |

---

## PLAN Header Format

```markdown
## PLAN

**Objective:** Brief description of what this PR achieves.

**Non-Goals:** What this PR explicitly does NOT do.

**Files:**
- file1.py
- file2.py

**Risk Tier:** T1/T2/T3

**Rollback:**
- Revert commit / close PR without merge.
```

---

## Validation Tests

### Negative Test: Missing PLAN Field → FAIL

**PR #33**: [test/plan-failure](https://github.com/ranjan-expatready/autonomous-engineering-os/pull/33)
- **Purpose**: Validates machine-board fails when PLAN missing required fields
- **Test**: Missing "Files" field
- **Expected**: machine-board FAIL
- **Status**: ✅ Verified - machine-board correctly detects missing field

### Positive Test: Complete PLAN → PASS

**PR #34**: [test/plan-pass](https://github.com/ranjan-expatready/autonomous-engineering-os/pull/34)
- **Purpose**: Validates machine-board passes with complete PLAN
- **Test**: All 5 required fields present
- **Expected**: machine-board PASS
- **Status**: ✅ Verified - machine-board correctly validates structure

---

## MACHINE BOARD VALIDATION

The governance validator checks PLAN structure for:

### When PLAN Required
- T1/T2 risk tier in PR description
- Protected paths changed (GOVERNANCE/, AGENTS/, etc.)

### Validation Logic
1. Detect if PR requires PLAN (T1/T2 or protected path)
2. Parse PR description for PLAN section
3. Check all 5 required fields present
4. Report PASS or FAIL with missing fields

### Validation Output
```
✅ PASS - PLAN Structure
  All required PLAN fields present (5/5)

❌ FAIL - PLAN Structure
  Missing required fields: Files, Risk Tier
```

---

## Risk Tier Enforcement

| Risk | PLAN Required | Trae Review | Machine Board |
|------|--------------|-------------|---------------|
| T1 | ✅ Yes | ✅ Yes | ✅ Enforces all checks |
| T2 | ✅ Yes | ✅ Yes | ✅ Enforces all checks |
| T3 | ⚠️ Optional | ❌ No | ✅ CI + basic checks |
| T4 | ❌ No | ❌ No | ✅ CI only |

---

## Verification Commands

```bash
# Run governance validator locally
python scripts/governance_validator.py

# Check PLAN structure
python -c "from scripts.governance_validator import REQUIRED_PLAN_FIELDS; print(REQUIRED_PLAN_FIELDS)"

# Run PLan tests
python tests/test_governance_plan_structure.py
```

---

## Common Failures + What To Do

### Missing PLAN Section
**Symptom**: machine-board reports "No PLAN header found"
**Fix**: Add ## PLAN section to PR description

### Missing Required Field
**Symptom**: machine-board reports "Missing fields: Files, Rollback"
**Fix**: Add the missing fields to PLAN section

### Incomplete Field Format
**Symptom**: machine-board reports malformed field
**Fix**: Use correct format: **Field:** value

---

## Evidence

Test evidence captured in:
- COCKPIT/artifacts/PLAN-TEST-NEGATIVE/ (PR #33)
- COCKPIT/artifacts/PLAN-TEST-POSITIVE/ (PR #34)
- FRAMEWORK/EVIDENCE_INDEX.md

---

## Version History

- v1.0 (2026-01-29): Initial PLAN-required governance definition with test evidence

---

**Document Version**: v1.0
**Last Updated**: 2026-01-29
**Status**: CANONICAL
