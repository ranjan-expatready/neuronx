# Test Plan: 10 Golden Use Cases (Phase 2.1)

**Status:** Canonical Plan
**Date:** 2026-01-25
**Goal:** Prove end-to-end functionality for the 10 Golden Use Cases using executable tests.

## Strategy
*   **Real Chain:** Prefer API-driven integration tests (`supertest` / `playwright request`) that hit the real Controller -> Service -> DB path.
*   **UI Verification:** Use Playwright for "Headed" verification of the Operator and Manager UIs.
*   **Mocking:** Minimal. Only mock external vendors (GHL, Twilio). Do NOT mock internal services (LeadScorer, BillingGuard).

---

## Use Case Mapping

### 1. Inbound Lead Ingestion (IntegrationBot)
*   **Specs:** `POST /api/webhooks/ghl` -> DB (Events) -> EventBus.
*   **Selected Test:** `tests/e2e/specs/backend-api.spec.ts`
*   **Type:** E2E (API)
*   **Status:** 🟢 **Existing**. Verifies 201 Created and Idempotency.
*   **Gap:** Needs to assert `sales.lead.created` event payload details.

### 2. Auto-Qualification & Scoring (System)
*   **Specs:** Event `sales.lead.created` -> `LeadScorerService`.
*   **Selected Test:** `apps/core-api/test/phase4a-qualification-flow.e2e-spec.ts`
*   **Type:** E2E (Process)
*   **Status:** 🟢 **Existing**. Verifies scoring logic and opportunity creation.

### 3. High-Value Routing (System)
*   **Specs:** Score > Threshold -> `LeadRouterService` -> GHL Update.
*   **Selected Test:** `apps/core-api/src/sales/__tests__/sales-routing-chain.integration.spec.ts`
*   **Type:** Integration (Real Chain)
*   **Status:** 🟢 **Existing**. Verifies "High Score" leads route to specific teams.

### 4. Work Queue Assignment (System -> Operator)
*   **Specs:** Routing Failure/Risk -> `WorkQueueService` -> DB (`WorkItem`).
*   **Selected Test:** `apps/core-api/src/work-queue/__tests__/work-queue-scope.spec.ts`
*   **Type:** Integration
*   **Status:** 🟡 **Partial**. Verifies scoping (tenant isolation) but needs to verify *creation* from routing failure.

### 5. Operator Manual Approval (Operator)
*   **Specs:** UI Action -> `POST /tasks/:id/approve` -> `SalesService.resume()`.
*   **Selected Test:** `tests/e2e/specs/journey-proof-pack.spec.ts`
*   **Type:** E2E (UI)
*   **Status:** 🟡 **Weak**. Currently runs in `dry_run` mode. Needs to be updated to hit real backend endpoints in a controlled environment.

### 6. Billing Limit Enforcement (System)
*   **Specs:** `BillingGuard` intercept -> Check `PlanLimits` -> Block/Allow.
*   **Selected Test:** `apps/core-api/src/usage/__tests__/usage-metering.spec.ts`
*   **Type:** Integration
*   **Status:** 🟢 **Existing**. Verifies limit enforcement logic.

### 7. Manager Scorecard View (Manager)
*   **Specs:** `GET /api/scorecards` -> UI Table.
*   **Selected Test:** `tests/e2e/specs/journey-proof-pack.spec.ts`
*   **Type:** E2E (UI)
*   **Status:** 🟢 **Existing**. Verifies UI rendering of scorecards.

### 8. Routing Policy Update (TenantAdmin)
*   **Specs:** Config Change -> Reload -> New Logic Applied.
*   **Selected Test:** `apps/core-api/src/sales/__tests__/routing.config.spec.ts`
*   **Type:** Integration
*   **Status:** 🟢 **Existing**. Verifies config hot-reloading (or restart behavior).

### 9. Token Rotation (TenantAdmin/System)
*   **Specs:** OAuth Expiry -> Refresh Flow -> New Token.
*   **Selected Test:** `apps/core-api/test/ghl-oauth-flow.e2e-spec.ts`
*   **Type:** E2E (Auth)
*   **Status:** 🟢 **Existing**. Verifies the full OAuth dance.

### 10. Audit Log Inspection (TenantAdmin/Compliance)
*   **Specs:** Query `EventStore` -> JSON Trace.
*   **Selected Test:** `apps/core-api/test/mvp-spine.e2e-spec.ts`
*   **Type:** E2E (Data)
*   **Status:** 🟢 **Existing**. Verifies audit events are emitted.

---

## Execution Plan (Next Steps)
1.  **Hardening:** Update `backend-api.spec.ts` to assert specific event payloads (Gap #1).
2.  **Reality Check:** Refactor `journey-proof-pack.spec.ts` to support a `LIVE_MODE` where it hits real APIs instead of just dry-run mocks (Gap #5).
3.  **Integration:** Connect "Work Queue" test explicitly to the "Routing Failure" trigger (Gap #4).
