# BEST PRACTICES — AUTONOMOUS ENGINEERING OS

Version: v1.0
Status: CANONICAL
Risk Tier: T0
Owner: Antigravity (CTO)
Enforcement: Machine Board + Trae (Advisory)

---

## 1. Planning Discipline (MANDATORY)

Every non-trivial change MUST include a PLAN artifact with:

- Objective (what success means)
- Non-Goals (explicit exclusions)
- Files / Directories Touched
- Risk Tier (T0–T4)
- Rollback Strategy

Missing any field = governance failure.

---

## 2. Execution Discipline

- One PR per logical change
- One Droid owns execution at a time
- No direct commits to main
- No multi-purpose PRs

---

## 3. Change Size Discipline

- Prefer small, reversible diffs
- Large refactors require explicit justification in PLAN
- Rollback must be realistic, not theoretical

---

## 4. Ownership & Handoff Discipline

- Antigravity decides intent
- Factory executes
- Trae challenges
- Founder approves only when required

No role overlap is permitted.

---

## 5. Verification Discipline

- CI must pass
- Evidence must exist
- Artifacts must be committed
- State ledger must be updated

---

## 6. Anti-Patterns (STRICTLY DISALLOWED)

- Self-modifying governance
- Silent behavior changes
- Bypassing validation with "urgent" rationale
- Overloaded PRs

Violations escalate risk tier automatically.
