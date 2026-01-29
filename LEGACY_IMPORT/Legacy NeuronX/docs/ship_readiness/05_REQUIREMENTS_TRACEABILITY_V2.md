# Requirements Traceability v2

**Status:** Draft (Phase 1 Output)
**Date:** 2026-01-25
**Purpose:** Precise mapping of Requirements (REQ) and Epics (EPIC) to verifiable code, tests, and evidence.

## Legend
*   🟢 **Verified:** Code exists, tests pass, fully meets requirement.
*   🟡 **Partial:** Code exists but uses heuristics/mocks instead of full solution (e.g., Rules vs AI).
*   🔴 **Missing:** No significant implementation found.
*   💀 **Prohibited:** Successfully not implemented (for prohibitions).

## 1. Core Intelligence (EPIC-01, EPIC-02)

| ID | Requirement | Status | Code Reference | Reality Check |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-001** | AI-driven sales orchestration | 🟡 | `apps/core-api/src/sales/sales.service.ts` | Orchestration exists, but "AI" is heuristic rules. |
| **REQ-002** | Multi-channel execution | 🟢 | `packages/adapters/` | Supported via GHL Adapter. |
| **REQ-005** | Own business rules/scoring | 🟢 | `apps/core-api/src/sales/lead-scorer.service.ts` | Logic is internal, not in GHL. |
| **REQ-006** | Own AI models/analytics | 🟡 | `apps/core-api/src/sales/lead-scorer.service.ts` | "Models" are static math rules currently. |

## 2. Integration & Boundaries (EPIC-04)

| ID | Requirement | Status | Code Reference | Reality Check |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-007** | Adapters as protocol translation | 🟢 | `packages/adapters/ghl/ghl.adapter.ts` | Adapters are stateless. |
| **REQ-008** | No logic in external platforms | 🟢 | *N/A (Process)* | Verified by `00B_REALITY_VS_INTENT.md`. |
| **REQ-011** | GHL as execution layer only | 🟢 | `apps/core-api/src/integrations/ghl/` | GHL used for UI/DB, NeuronX for logic. |
| **REQ-012** | Adapter-first pattern | 🟢 | `packages/adapters/` | Architecture adheres to this. |

## 3. Security & Infrastructure (EPIC-03, EPIC-05)

| ID | Requirement | Status | Code Reference | Reality Check |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-013** | Tenant isolation (DB level) | 🟢 | `apps/core-api/src/` | Tenant ID filtering observed. |
| **REQ-014** | Agency/Location operations | 🟢 | `packages/security/token-vault/` | Token scopes support this. |
| **REQ-015** | Webhook signature validation | 🟢 | `apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts` | HMAC verification implemented. |
| **REQ-016** | Secure token lifecycle | 🟢 | `packages/security/token-vault/` | Envelope encryption used. |
| **REQ-RATE** | Tenant-aware rate limiting | 🟢 | `apps/core-api/src/rate-limit/` | Rate limits enforced. |

## 4. Quality & Testing (EPIC-06)

| ID | Requirement | Status | Code Reference | Reality Check |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-017** | 85%+ Code Coverage | 🟡 | `vitest.config.ts` | Config exists, coverage actuals need verification. |
| **REQ-018** | Adapter contract tests | 🟢 | `tests/contract/ghl-adapter.contract.spec.ts` | Contract tests present. |
| **REQ-019** | Configuration as IP | 🟢 | `config/*.yaml` | Config files are the SSOT. |

## 5. Prohibitions (Scope Control)

| ID | Requirement | Status | Code Reference | Reality Check |
| :--- | :--- | :--- | :--- | :--- |
| **REQ-003** | No UI components in core | 🟢 | `apps/core-api` | Core is API-only. UI is in separate apps. |
| **REQ-004** | No physical infra management | 🟢 | *N/A* | Cloud-native assumption. |
