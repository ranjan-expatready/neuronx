# Reality vs. Intent — Productization Phase 0

## Executive Summary
NeuronX is functionally a **robust rule engine** with a modern React/Next.js frontend. While it markets itself as "AI-driven," the current implementation is deterministic and configuration-based. The infrastructure (Security, Billing, API) is production-grade, but the "Intelligence" layer is currently heuristic.

## 1. What Exists (The "Real" Product)
These features are implemented, tested, and verifiable in the codebase.

### Core Infrastructure
*   **✅ Role-Based Access Control (RBAC):** Granular permissions (`webhooks:read`, `secrets:rotate`) and clear roles.
*   **✅ Security:** Production-ready `TokenVault` using Envelope Encryption (Master Key → KEK → DEK).
*   **✅ Billing Engine:** Sophisticated `EntitlementEvaluator` supporting Block, Monitor-Only, and Grace Period modes.
*   **✅ Event Bus:** Webhook ingestion from GHL is fully wired (`contact.created` → `neuronx.contact.ingested`).

### Business Logic
*   **✅ Deterministic Scoring:** `LeadScorerService` exists but uses static math (e.g., `Paid Source = +80`).
*   **✅ Config-Based Routing:** `LeadRouterService` routes based on YAML policies (`channel-routing-policy.yaml`), not ML.
*   **✅ Finite State Machine:** Sales lifecycle is strictly governed by `SalesStateMachine`, preventing illegal state transitions.

### User Interface
*   **✅ Operator Console:** Functional UI for task management and work queues.
*   **✅ Manager Console:** Read-only dashboards for team metrics.
*   **✅ Component Library:** Shared `ui-design-system` package ensures consistency.

## 2. What is Partially Built (The "Gap")
These features exist in code but are either stubbed, incomplete, or mocks.

*   **⚠️ "AI" Scoring:** Currently 100% heuristic. No ML model inference, no training loop, no feedback mechanism.
*   **⚠️ Authentication:** `AdminGuard` is a stub (checks `token.length > 10`). Real JWT/OAuth validation needs to be finalized for production.
*   **⚠️ Admin UI:** Configuration (Billing, Routing, Skills) is done via **YAML files** in the repo. There is no UI for a Tenant Admin to change these settings self-serve.
*   **⚠️ GHL Integration:** Inbound webhooks are handled, but the *outbound* control (writing back to GHL) relies on adapters that need verification of full coverage.

## 3. What is Missing (The "Vision")
These are implied by the "AI Orchestration" mission but are absent from the codebase.

*   **❌ True Intelligence:** No LLM integration, no predictive modeling for lead conversion.
*   **❌ Dynamic Adaptation:** The system does not "learn" from operator decisions. If an operator rejects a route 10 times, the YAML config does not update automatically.
*   **❌ Self-Onboarding:** No flow for a new tenant to sign up, configure their API keys, and start without engineering intervention (YAML edits).
*   **❌ Advanced Analytics:** "Manager Console" exists but relies on simple metrics. No trend analysis or forecasting.

## 4. What is Dead / Unused
*   **💀 `humanOnlyChannels`:** Defined in `channel-routing-policy.yaml` but currently empty (`[]`). The capability to force human-only channels exists but is not leveraged.
*   **💀 "Experiment" Usage Type:** Billing supports `EXPERIMENT` tracking, but no active A/B testing framework was found in the core logic.

## 5. Summary Table

| Feature Area | Claim | Reality | Status |
| :--- | :--- | :--- | :--- |
| **Scoring** | "AI-Powered Predictive Scoring" | Static Rules (+80 points for Paid) | 🟡 Partial / Mock |
| **Routing** | "Intelligent Best-Rep Matching" | YAML Config (Region/Value matching) | 🟡 Partial |
| **Security** | "Enterprise Grade" | Envelope Encryption, RBAC | 🟢 **Solid** |
| **Billing** | "Flexible Plans" | Guard-based enforcement, highly configurable | 🟢 **Solid** |
| **Admin** | "Full Control" | File-based Config (GitOps style) | 🔴 Missing UI |
| **Auth** | "Secure Access" | Stubbed Token Validation | 🔴 Needs Fix |
