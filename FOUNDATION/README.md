# FOUNDATION — Company Constitution

## Overview

The FOUNDATION directory contains the constitutional documents of Autonomous Engineering OS. These are the highest-priority artifacts that define the company's identity, purpose, and operating principles.

All agents and systems must read and align with these documents before taking any action.

---

## Contents

### `01_VISION.md` — The North Star
**Canonical Company Law**

This document defines:
- What Autonomous Engineering OS is
- The problem it solves
- The breakthrough architecture (Antigravity, Factory, Trae)
- How work happens
- The $10M+ product thesis
- The long-term strategic vision

**Status**: CANONICAL ✅
**Version**: v1.0
**Owner**: Antigravity (CTO)
**Last Updated**: 2026-01-26

---

## How These Documents Are Used

### By Antigravity (The AI CTO)
- Must read FOUNDATION/01_VISION.md before generating any PLAN
- Must verify all work aligns with the Vision
- Must reference Vision when making strategic decisions

### By Factory Droids (The AI Engineering Org)
- Must read FOUNDATION/01_VISION.md before executing any task
- Must produce outputs that support the Vision
- Must never produce work that contradicts the Vision

### By Trae (The External Auditor)
- Uses FOUNDATION/01_VISION.md as evaluation baseline
- Checks all reviews for Vision alignment
- Can veto changes that conflict with the Vision

### By Founder
- Approves or rejects strategy based on Vision alignment
- Uses Vision to evaluate long-term product decisions
- References Vision when defining company direction

### By Machine Board
- Fails PRs that contradict FOUNDATION/01_VISION.md
- Automatically validates Vision alignment for all governance changes
- Treats VISION.md as constitutional law (cannot be overridden without explicit Founder approval)

---

## Constitutional Status

All files in FOUNDATION/ have **CONSTITUTIONAL STATUS**:

| Priority | Meaning |
|----------|---------|
| T0 (Critical) | Cannot be changed without Founder explicit approval and 2-factor review |
| Canonization | Only Antigravity + Founder can modify FOUNDATION/ documents |
| Override Prevention | Machine Board blocks any PR that contradicts Vision |
| Trae Review | Trae must review all FOUNDATION/ changes (mandatory) |

---

## Version Control

All FOUNDATION/ documents follow strict version control:

- **Canonical versions** are marked with `Status: CANONICAL`
- **Draft versions** are marked with `Status: DRAFT`
- **Version numbers** follow semantic versioning (v1.0, v1.1, v2.0)
- **Change history** must be documented in each file footer

---

## Amendment Process

To amend any FOUNDATION/ document:

1. **Propose Amendment** (T0 change)
   - Create PR with proposed changes
   - Document rationale for amendment
   - Get Trae review (mandatory)
   - Get Founder explicit approval (required)

2. **Review Impact**
   - Antigravity evaluates impact on existing work
   - Factory assesses implementation changes required
   - Trae validates alignment with original Vision

3. **Ratify and Commit**
   - Founde approves by explicit comment
   - Machine Board validates (T0 risk tier)
   - Merge only when all gates passed

4. **Update System State**
   - Antigravity updates internal planning to reflect new Vision
   - Factory re-aligns all droid protocols
   - Trae updates review baselines

---

## Non-Negotiables

These principles cannot be overridden:

1. **Safety First**: Trae is always the final risk reviewer
2. **Governance**: No execution bypasses Machine Board validation
3. **Auditability**: Every action produces evidence
4. **Reversibility**: All operations are atomic and revertible
5. **Transparency**: All state is readable and reviewable

---

## Related Documents

- `FRAMEWORK/PROGRESS.md` — Infrastructure alignment with Vision
- `FRAMEWORK/EVIDENCE_INDEX.md` — Vision implementation evidence
- `STATE/STATUS_LEDGER.md` — Operational state tracking
- `RUNBOOKS/antigravity.md` — Antigravity operations (Vision-first)

---

## Questions?

Any questions about FOUNDATION/ documents should be directed to:
- Antigravity (CTO) — Operational interpretation
- Founder — Strategic clarification

---

## Definition of Done for FOUNDATION Canon

Checklist for FOUNDATION completion:

### Files Created ✅
- [x] 01_VISION.md — Company Constitution (v1.0, CANONICAL)
- [x] 02_SYSTEM_ARCHITECTURE.md — System architecture with Mermaid diagrams
- [x] 03_GOVERNANCE_MODEL.md — Risk tiers, Machine Board, Trae enforcement
- [x] 04_AGENT_MODEL.md — Droid roster, responsibilities, handoffs
- [x] 05_ANTIGRAVITY.md — AI CTO role, cockpit access, daily loop
- [x] 06_TRAE.md — External auditor, artifact format, validation
- [x] 07_FACTORY.md — AI workforce, execution rules, PR-only flow
- [x] 08_SDLC.md — State machine, minimum steps to ship
- [x] 09_FOUNDER_PLAYBOOK.md — Operating manual, daily workflow
- [x] 10_INVESTOR_STORY.md — $10M+ thesis, defensibility, SaaS roadmap
- [x] diagrams/README.md — Diagram index with links
- [x] FOUNDATION/README.md (updated) — This file with DoD checklist

### Diagrams (Mermaid Embedded) ✅
- [x] System Architecture diagram
- [x] Daily Loop diagram
- [x] PR Workflow diagram
- [x] State Machine diagram
- [x] Artifact Flow diagram
- [x] Governance Gates diagram
- [x] Agent Coordination diagram
- [x] Trae Review Flow diagram
- [x] Factory Execution diagram
- [x] SDLC Flow diagram
- [x] SaaS Architecture diagram (Investor Story)

### Template Created ✅
- [x] TEMPLATE/README.md — Bootstrap instructions for new repos

### PNG Export (Optional) ⏸️
- [ ] system_map.png (optional)
- [ ] agent_flow.png (optional)
- [ ] governance_gates.png (optional)
- [ ] daily_loop.png (optional)

**Note**: PNG export is optional and not required for canonical status. Mermaid diagrams are sufficient.

---

**Last Updated**: 2026-01-26
**Maintained By**: Antigravity (CTO)
**Canonical Status**: COMPLETE ✅
**Review Frequency**: Quarterly (or upon major strategic shifts)
