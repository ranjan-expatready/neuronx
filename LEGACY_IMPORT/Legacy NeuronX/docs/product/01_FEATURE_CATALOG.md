# NeuronX Feature Catalog (Phase 0 Reality)

**Status:** Canonical Inventory
**Last Updated:** 2026-01-25
**Source:** Codebase Scan + Existing Docs

## 1. Core Journeys (The "Golden Path")

### Journey A: Lead Ingestion & Normalization
*   **Description:** Processing of inbound signals from external systems (GHL) into canonical internal events.
*   **Current Reality:** Fully implemented for GHL Webhooks.
*   **Code References:**
    *   **Controller:** [ghl-webhook.controller.ts](apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts) (Validates signatures, rate limits)
    *   **Normalization:** `WebhookNormalizer` (Transforms `contact.created` → `sales.lead.created`)
    *   **Persistence:** [SalesService](apps/core-api/src/sales/sales.service.ts) (Idempotent event storage)

### Journey B: Lead Scoring (Heuristic)
*   **Description:** Assigning a numerical value (0-100) to a lead to determine qualification.
*   **Current Reality:** **Deterministic Rule Engine**. "AI" is currently static math.
*   **Code References:**
    *   **Service:** [LeadScorerService](apps/core-api/src/sales/lead-scorer.service.ts) (Likely location based on pattern)
    *   **Rules:** Hardcoded modifiers (e.g., `Paid Source = +80`).
    *   **Status:** 🟡 **Partial** (Claim is AI, Reality is Rules).

### Journey C: Routing & Assignment
*   **Description:** Matching a qualified lead to the best available execution channel or human agent.
*   **Current Reality:** **Configuration-Based**. Uses YAML policies to match attributes.
*   **Code References:**
    *   **Service:** [LeadRouterService](apps/core-api/src/sales/lead-router.service.ts)
    *   **Policy:** `config/channel-routing-policy.yaml` (Static mapping).
    *   **Status:** 🟡 **Partial** (No predictive matching).

### Journey D: Operator Work Queue
*   **Description:** Human-in-the-loop interface for high-risk or low-confidence decisions.
*   **Current Reality:** Functional React UI.
*   **Code References:**
    *   **API:** `apps/core-api/src/ui/ui.controller.ts` (Serves queue items)
    *   **Frontend:** `apps/operator-ui/src/pages/work-queue` (Task list)
    *   **Status:** 🟢 **Solid**.

### Journey E: Manager Oversight
*   **Description:** Aggregate view of team performance and rep efficiency.
*   **Current Reality:** Read-only dashboards.
*   **Code References:**
    *   **Frontend:** `apps/manager-ui/src/pages/manager` (Scorecards)
    *   **Status:** 🟢 **Solid**.

---

## 2. Integrations & Adapters

### GoHighLevel (GHL)
*   **Inbound:** Webhook Receiver (`contact.created`, `opportunity.status_changed`).
    *   [ghl-webhook.controller.ts](apps/core-api/src/integrations/ghl/ghl-webhook.controller.ts)
*   **Outbound:** `GhlAdapter` for executing actions (add tag, send SMS).
    *   [ghl.adapter.ts](packages/adapters/ghl/ghl.adapter.ts)
*   **Auth:** OAuth2 handshake with `TokenVault` storage.
    *   [oauth.ts](packages/integration/ghl-auth/src/oauth.ts)

---

## 3. Security & Governance

### Authentication & Authorization
*   **RBAC:** Role-based access (TenantAdmin, Operator, Manager).
    *   [auth.guard.ts](apps/core-api/src/authz/auth.guard.ts)
*   **Token Storage:** Envelope encryption for sensitive tokens.
    *   [token-vault.service.ts](packages/security/token-vault/src/token-vault.service.ts)
*   **Gap:** AdminGuard is currently a stub (checks token length).

### Billing Enforcement
*   **Mechanism:** Intercepts execution commands to check against plan limits.
*   **Modes:** Block, Monitor-Only, Grace Period.
*   **Code References:**
    *   [billing-guard.ts](packages/billing-entitlements/src/billing-guard.ts)
    *   [entitlement.evaluator.ts](packages/billing-entitlements/src/entitlement.evaluator.ts)

---

## 4. Configuration Model
*   **Format:** YAML/JSON files in `config/` directory.
*   **Scope:** Routing rules, Billing plans, Channel policies.
*   **Gap:** No UI for Tenant Admin to modify these. "GitOps" only.
