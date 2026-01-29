# Plan Backlog

## Phase 2: Golden Use Cases (Execution)
**Goal:** Prove the 10 Golden Use Cases with executable tests (Phase 2.1).

### 2.1 Test Coverage Hardening
- [ ] **2.1.1**: Enhance `backend-api.spec.ts` to assert `sales.lead.created` event payload details (Gap #1).
- [ ] **2.1.2**: Refactor `journey-proof-pack.spec.ts` to support `LIVE_MODE` for real API approval testing (Gap #5).
- [ ] **2.1.3**: Update `work-queue-scope.spec.ts` to explicitly test creation from routing failure (Gap #4).

### 2.2 Admin UI (Minimum Viable)
- [ ] **2.2.1**: Add "Routing Rules" editor to Operator/Manager UI.
- [ ] **2.2.2**: Add "Billing Tiers" editor.
- [ ] **2.2.3**: Add "Webhook Secrets" manager.

### 2.3 Production Safety Nets (P0 Gaps)
- [ ] **2.3.1**: Webhook timestamp tolerance (Replay Protection).
- [ ] **2.3.2**: Async Ingestion (Return 202 + Background Job).
- [ ] **2.3.3**: Dead Letter Queue (DLQ) for failed events.
- [ ] **2.3.4**: Basic Observability Metrics (`leads_processed_total`, etc.).

### 2.4 Demo Mode
- [ ] **2.4.1**: Create Seed Data Script (2 tenants, 3 teams, 10 leads).
- [ ] **2.4.2**: Create "Headed Demo Script" in Playwright.

---

## Core User Journeys (Acceptance Criteria)

### Journey 1: Lead Ingestion & Scoring
**As a** System,
**I want to** ingest a lead from a webhook and calculate its score,
**So that** I can determine if it's worth pursuing.

**Acceptance Criteria:**
-   [x] Webhook endpoint accepts standard lead payload.
-   [x] Lead is persisted to database (Prisma).
-   [ ] Decision Engine calculates a score (mocked or real).
-   [ ] `LeadQualified` event is emitted if score > threshold.
-   [x] Audit log records ingestion and scoring events.

### Journey 2: Intelligent Routing
**As a** Sales Manager,
**I want** qualified leads to be routed to the best available rep,
**So that** conversion rates are maximized.

**Acceptance Criteria:**
-   [ ] System listens for `LeadQualified` event.
-   [ ] Router selects rep based on availability and skills (or round-robin fallback).
-   [ ] Assignment is persisted.
-   [ ] `LeadAssigned` event is emitted.

### Journey 3: System Health & Audit
**As an** Operator,
**I want to** see the flow of events and system status,
**So that** I can debug issues and ensure compliance.

**Acceptance Criteria:**
-   [x] Health check endpoint returns 200 OK and DB status.
-   [x] All major state changes (Ingest, Score, Assign) have trace IDs.
-   [x] Logs are structured (JSON) and contain correlation IDs.

---

## Phased Plan

### Phase C: Stabilize Build + Run
**Goal**: Make the repo workable for developers.
-   [x] **C1**: Generate Prisma Client (`pnpm prisma generate`).
-   [x] **C2**: Fix Vitest vs Jest conflict (remove `jest` globals usage in Vitest files or config Vitest to support them).
-   [x] **C3**: Fix ESLint configuration (add `vitest` env/globals).
-   [x] **C4**: Standardize `.env` setup.

### Phase D: Fix Highest Impact Breakages
**Goal**: Get tests passing and core flows working.
-   [ ] **D1**: Fix `routing.config.spec.ts` logic errors. (Moved to Quarantine - see `QUARANTINE_LIST.md`)
-   [x] **D2**: Fix `storage-keys.spec.ts` matcher errors (`toEndWith`).
-   [x] **D3**: Fix `sla.service.spec.ts` (`jest` not defined).
-   [ ] **D4**: Verify Lead Ingestion flow via integration test.

### Phase D-2: Post-Readiness Cleanups (Quarantine Resolution)
**Goal**: Resolve quarantined items.
-   [ ] **D1-Fix**: Fix `routing.config.spec.ts`.
    -   **Context**: 13 tests failing due to unmocked `ConfigLoader`.
    -   **Criteria**: All tests in suite pass.
    -   **Owner**: Backend Team.


### Phase E: QA Gates + CI
**Goal**: Prevent regression.
-   [ ] **E1**: Configure GitHub Actions to run `pnpm test:unit` and `pnpm lint`.
-   [ ] **E2**: Add a "Smoke Test" script that spins up the app and hits the health endpoint.

### Phase F: Release Readiness
**Goal**: Ship it.
-   [ ] **F1**: Update README with verified "Getting Started" steps.
-   [ ] **F2**: Create a Release Checklist.
-   [x] **F3**: One-Command Verification Script.

### Phase G: World-Class Gap Closure (Prioritized from Gap Audit)
**Goal**: Reach $1M Product Readiness (Score 20+/25).

#### P0: Critical Reliability & Security (Must Have)
- [ ] **G1 (Security)**: Implement Timestamp Tolerance in `WebhookSigner`.
    - **Criteria**: Reject webhooks older than 5 minutes.
- [ ] **G2 (Reliability)**: Async Webhook Ingestion.
    - **Criteria**: Webhook endpoint returns 202 immediately; processing happens in background.
- [ ] **G3 (Reliability)**: Dead Letter Queue (DLQ).
    - **Criteria**: Failed events are captured in a `DLQ` table/queue after N retries.

#### P1: Observability & Operability (Should Have)
- [ ] **G4 (Observability)**: Add Metrics (Prometheus/OpenTelemetry).
    - **Criteria**: Dashboard showing Leads/min, Error Rate, Latency.
- [ ] **G5 (Operability)**: Create Runbooks.
    - **Criteria**: "How to debug stuck lead", "How to rotate secrets".

#### P2: Product Maturity (Nice to Have)
- [ ] **G6 (Entitlements)**: Dynamic Tier Configuration.
    - **Criteria**: Tiers loaded from DB, not hardcoded.
- [ ] **G7 (Security)**: Secret Rotation API.
    - **Criteria**: Zero-downtime rotation support.

## "Stop Doing" / Out of Scope
-   Frontend UI polish (focus on API/Backend correctness).
-   Complex ML models for scoring (use simple logic/mocks).
-   Real GHL integration (use mocks/adapters).
