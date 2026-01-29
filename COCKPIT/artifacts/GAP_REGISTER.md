# System Gap Register
**Date**: 2026-01-29
**Auditor**: Antigravity (CTO)

## 1. Governance & Hygiene
| ID | Gap | Severity | Evidence | Impact | Remediation |
|---|---|---|---|---|---|
| G-01 | Legacy Import Persists | **High** | `ls -F` shows `LEGACY_IMPORT/` present. PR6 status unclear. | Duplicate code, confusion, violation of single-source-of-truth. | **Immediate**: Re-execute deletion via PR. |

## 2. DevOps & Build
| ID | Gap | Severity | Evidence | Impact | Remediation |
|---|---|---|---|---|---|
| D-01 | Core API Build Failure | **Blocker** | `nest build` fails with 274+ TS errors (`TS2339`, `TS2353`). | Backend services cannot be deployed. | **Immediate**: Fix `tsconfig` paths, ensure `prisma generate` runs in CI/build, resolve type mismatches. |
| D-02 | Web App Build Failure | **Blocker** | `customer-trust-portal` fails `next build`. | Frontend cannot be deployed. | **Immediate**: Fix `next.config.js` and `tsconfig` paths. |
| D-03 | Database Synchronization | **High** | Walkthrough mentions pending `prisma migrate`. | Runtime errors due to schema mismatch. | **Immediate**: Run migrations against local/dev DB. |

## 3. Quality & Testing
| ID | Gap | Severity | Evidence | Impact | Remediation |
|---|---|---|---|---|---|
| Q-01 | Test Suite Failure | **High** | `pnpm test` fails (158 failures). | Inability to verify regressions. | **High**: Fix build first, then address test failures. |

## 4. Agents & Workflows
| ID | Gap | Severity | Evidence | Impact | Remediation |
|---|---|---|---|---|---|
| A-01 | CI Workflow Gaps | Medium | CI runs `lint`, `test`, `build` but failed locally. | CI pipeline will stay red. | **Deferred**: Fix D-01/D-02/Q-01 first. |

---

## Remediation Plan

### Phase 1: Stabilization (Immediate)
1.  **PR-FIX-1**: Delete `LEGACY_IMPORT` (Close G-01).
2.  **PR-FIX-2**: Fix `Core API` Build (Close D-01, D-03).
3.  **PR-FIX-3**: Fix `Customer Portal` Build (Close D-02).

### Phase 2: Quality (Follow-up)
1.  **PR-FIX-4**: Fix Test Suite (Close Q-01).
