# Requirements Traceability & Verification

## Executive Summary
This document maps business requirements (User Journeys) to technical evidence (Tests). It serves as the source of truth for "Feature Complete" status.

**Status Legend:**
- ✅ **Verified**: Covered by passing automated tests.
- ⚠️ **Partial**: Covered by unit tests but missing integration/E2E glue.
- ❌ **Missing**: No automated verification found.
- ❓ **Unknown**: Evidence pending investigation.

---

## 1. Core User Journeys

### Journey 1: Lead Ingestion & Scoring
**Goal**: Ingest a lead from a webhook, persist it, and calculate a score.

| Requirement | Acceptance Criteria | Status | Evidence / Test File | Notes |
|-------------|---------------------|--------|----------------------|-------|
| **Ingest** | Endpoint accepts standard lead payload | ✅ | `tests/e2e/specs/webhook-flow.spec.ts` | Verifies POST to `/api/webhooks/ghl` |
| **Security** | Rejects invalid signatures | ✅ | `tests/e2e/specs/webhook-flow.spec.ts` | Verifies `X-GHL-Signature` enforcement |
| **Security** | Idempotency (Replay Attack Prevention) | ✅ | `sales.service.integration.spec.ts`, `webhook-flow.spec.ts` | Verifies duplicate event IDs are handled |
| **Persistence** | Lead/Event persisted to DB | ✅ | `sales.service.integration.spec.ts` | Verifies `prisma.event.findUnique` |
| **Scoring** | Score calculated > threshold emits event | ✅ | `sales.service.integration.spec.ts` | Verifies `sales.lead.qualified` emission |
| **Audit** | Ingestion logged with Correlation ID | ✅ | `sales.service.integration.spec.ts` | Verifies metadata contains `correlationId` |

### Journey 2: Intelligent Routing
**Goal**: Route qualified leads to the best available rep.

| Requirement | Acceptance Criteria | Status | Evidence / Test File | Notes |
|-------------|---------------------|--------|----------------------|-------|
| **Trigger** | System processes `LeadCreated` and synchronously orchestrates Qualification and Routing. | ✅ | `sales-flow.integration.spec.ts` | **Truth**: Routing is triggered synchronously on `LeadCreated` by `SalesService`. Qualification is an internal step, not an async event trigger. |
| **Routing** | Selects rep based on rules (e.g. Country) | ✅ | `lead-router.integration.spec.ts` | Verifies Country mapping (IN -> india-team) |
| **Persistence** | Assignment persisted | ✅ | `lead-router.integration.spec.ts` | Verifies `sales.lead.routed` event |
| **Event** | `LeadAssigned` / `LeadRouted` event emitted | ✅ | `lead-router.integration.spec.ts` | Verifies event publication |

### Journey 3: System Health & Audit
**Goal**: Operator visibility into system status.

| Requirement | Acceptance Criteria | Status | Evidence / Test File | Notes |
|-------------|---------------------|--------|----------------------|-------|
| **Liveness** | GET /health/live returns 200 OK | ✅ | `observability/__tests__/health.spec.ts` |  |
| **Readiness** | GET /health/ready checks DB/Secret status | ✅ | `observability/__tests__/health.spec.ts` | Verifies dependency checks |
| **Tracing** | Trace IDs propagate across events | ✅ | `sales.service.integration.spec.ts` | Verifies `causationId` and `correlationId` |

---

## 2. Identified Gaps & Risks

### 1. E2E Database Verification (Medium Priority)
- **Observation**: `webhook-flow.spec.ts` checks the HTTP response but doesn't explicitly query the DB to verify persistence (unlike the integration test).
- **Action**: Enhance E2E to verify side effects (DB records created).

---

## 3. Decision Records

### DR-001: Synchronous Routing Orchestration
- **Decision**: We accept the current implementation where `SalesService` synchronously calls `LeadScorer` and `LeadRouter` upon receiving `LeadCreated`.
- **Rationale**:
  - **Simplicity**: Avoids the complexity of distributed event consistency for the $1M MVP.
  - **Latency**: Reduces end-to-end latency for the critical path.
  - **Traceability**: Easier to trace a single request ID through the synchronous stack.
- **Trade-off**: Coupling. `SalesService` knows about routing logic. This is acceptable for now.
- **Source of Truth**:
  - **Thresholds**: `ConfigService` (ultimately `neuronx-config` in DB/S3).
  - **Overrides**: Tenant Context loaded via `ConfigLoader`.

## 4. Definition of Done for $1M MVP (Product Manager View)

To consider this product "Ship Ready" for a $1M business case, we need more than just green tests. We need **Operational Confidence**.

1.  **Zero Lost Leads**:
    *   Webhooks must succeed 99.99%.
    *   Failed webhooks must be logged and replayable.
    *   **Proof**: Stress test webhook endpoint + Idempotency verification.

2.  **Correct Routing**:
    *   A lead from "US" *never* goes to "India Team".
    *   **Proof**: Parameterized tests covering all routing rules (Country, Source, Score).

3.  **Security**:
    *   No unauthenticated webhook ingestion.
    *   No secret leakage in logs.
    *   **Proof**: Security regression tests in CI.

4.  **Observability**:
    *   If a lead fails to route, an alert fires.
    *   We can trace a Lead ID from Webhook -> DB -> Rep.
    *   **Proof**: Log analysis verification.

5.  **Clean Deploy**:
    *   One command deploy.
    *   Health checks pass immediately.
