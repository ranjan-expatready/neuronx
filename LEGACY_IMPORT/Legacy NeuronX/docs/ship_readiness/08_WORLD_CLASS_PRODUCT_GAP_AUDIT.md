# World-Class Product Gap Audit

**Date**: 2026-01-25
**Auditor**: Trae (Acting FAANG PM/Lead)
**Scope**: Webhook Ingestion, Routing, Entitlements, Security, Operability.

---

## 1. World-Class Benchmark Research

### A. Webhook Ingestion & Security
**Benchmark**: Stripe, Twilio, Slack.
*   **Signature Verification**: HMAC-SHA256 with constant-time comparison (Standard).
*   **Replay Protection**:
    *   **Timestamp Tolerance**: Reject requests older than 5 minutes to prevent replay of valid signatures.
    *   **Idempotency Keys**: Cache keys for 24h to prevent double-processing.
*   **Secret Management**:
    *   **Rolling Secrets**: Support for 2 active secrets (old + new) during rotation.
    *   **Granular Scopes**: Secrets scoped to specific endpoints/events.
*   **Reliability**:
    *   **Async Ingestion**: Accept (202 Accepted) immediately, process asynchronously.
    *   **Decoupling**: Webhook receiver != Business Logic processor.

### B. Event Processing & Reliability
**Benchmark**: Uber, Netflix (Event-Driven Architectures).
*   **Guarantees**: At-least-once delivery.
*   **Failure Handling**:
    *   **Dead Letter Queues (DLQ)**: Failed events move to DLQ after N retries.
    *   **Retry Policy**: Exponential backoff (jittered).
*   **Observability**:
    *   **Distributed Tracing**: Trace ID propagates from Webhook -> Event -> DB -> External API.
    *   **Golden Signals**: Latency, Traffic, Errors, Saturation dashboards.

### C. Entitlements & Billing
**Benchmark**: Lago, Orb, Revenera.
*   **Architecture**:
    *   **Decoupled Enforcement**: Application asks "Can user do X?" (Policy Decision Point), separate from "How much did they use?" (Metering).
    *   **Dynamic Catalog**: Tiers/Plans defined in data (DB/JSON), not hardcoded in TypeScript.
*   **Features**:
    *   **Soft vs Hard Limits**: Warn at 80%, block at 100%.
    *   **Overrides**: Per-tenant limit overrides (e.g., "VIP Customer gets 2x quota").

---

## 2. NeuronX Gap Analysis

### 🔴 Critical Gaps (Must-Fix for $1M Scale)

| Area | Gap | Severity | Acceptance Criteria for V1 |
|------|-----|----------|----------------------------|
| **Security** | **Missing Timestamp Tolerance** | High | `WebhookSigner` must reject signatures older than 5 minutes. |
| **Reliability** | **Synchronous Webhook Processing** | High | Webhook endpoint should push to queue and return 202 immediately. Current `SalesService` runs logic synchronously. |
| **Observability** | **Missing Dead Letter Queue** | High | If `SalesService.handle` fails, event is lost or stuck in infinite retry loop (depending on bus). Need explicit DLQ. |
| **Entitlements** | **Hardcoded Tiers** | Medium | Tiers are defined in `EntitlementRepository.ts`. Product changes require Engineering Deploys. |
| **Operability** | **No Metrics/Dashboards** | Medium | No visibility into "Leads per Minute" or "Error Rate" without SQL queries. |

### 🟡 Maturity Gaps (V2 / Scale)

| Area | Gap | Severity | Notes |
|------|-----|----------|-------|
| **Security** | **Secret Rotation** | Medium | No mechanism to rotate webhook secrets without downtime. |
| **Routing** | **Event-Driven Decoupling** | Medium | `SalesService` orchestrates everything. Hard to extend. |
| **Entitlements** | **Real-time Metering** | Low | Usage counting is likely strictly DB-based (slow at scale). |

---

## 3. $1M Readiness Scorecard

| Category | Score (0-5) | Justification |
|----------|-------------|---------------|
| **Product Completeness** | **4/5** | Core journeys (Ingest, Score, Route) are solid and verified. |
| **Reliability** | **3/5** | Idempotency is good, but synchronous processing + no DLQ is a risk. |
| **Security** | **3/5** | Signatures verified, but no timestamp check or rotation. |
| **Observability** | **2/5** | Logs exist (Audit), but no Metrics/Tracing. Blind in production. |
| **Engineering** | **5/5** | Strong governance, CI, type safety, test strategy. |
| **TOTAL** | **17/25** | **Not yet $1M Ready** (Threshold: 20/25) |

**Recommendation**: **NO-GO** for General Availability. **GO** for Beta with trusted customers (controlled environment).

---

## 4. Prioritized Roadmap (Top 3)

1.  **Async Ingestion + DLQ**: Move business logic out of the webhook response path.
2.  **Timestamp Security**: Add replay protection window.
3.  **Observability**: Add basic Prometheus/OpenTelemetry metrics.
