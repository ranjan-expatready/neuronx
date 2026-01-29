# 10 Golden Use Cases

**Status:** Defined (Phase 1)
**Purpose:** The critical paths that MUST work for the product to be viable.

## Actors
*   **TenantAdmin:** The agency owner configuring the system.
*   **Operator:** The human reviewer handling exceptions.
*   **Manager:** The team lead monitoring performance.
*   **IntegrationBot:** The system actor (GHL) sending signals.
*   **System:** The internal cron/job processor.

## Use Cases

### 1. Inbound Lead Ingestion (IntegrationBot)
*   **Trigger:** New Contact Created in GHL.
*   **Action:** Webhook sent to `POST /webhooks/ghl`.
*   **Expected:** 200 OK. Lead created in NeuronX DB. Event `sales.lead.created` emitted.
*   **Criticality:** 🚨 **BLOCKER** (System entry point).

### 2. Auto-Qualification & Scoring (System)
*   **Trigger:** `sales.lead.created` event.
*   **Action:** `LeadScorerService` evaluates lead.
*   **Expected:** Score calculated. If > Threshold, status -> `QUALIFIED`.
*   **Criticality:** 🚨 **BLOCKER** (Core value prop).

### 3. High-Value Routing (System)
*   **Trigger:** Lead Qualified with High Score.
*   **Action:** `LeadRouterService` matches to "VIP Team".
*   **Expected:** Routing event emitted. GHL updated with new owner.
*   **Criticality:** 🚨 **BLOCKER**.

### 4. Work Queue Assignment (System -> Operator)
*   **Trigger:** Lead falls into "Manual Review" criteria (e.g., ambiguous location).
*   **Action:** System creates Task. Task appears in Operator UI.
*   **Expected:** Operator sees task in `apps/operator-ui`.
*   **Criticality:** 🔥 **High**.

### 5. Operator Manual Approval (Operator)
*   **Trigger:** Operator clicks "Approve" on a task.
*   **Action:** API `POST /tasks/:id/approve`.
*   **Expected:** Lead routed. Task marked done. Audit log updated.
*   **Criticality:** 🔥 **High**.

### 6. Billing Limit Enforcement (System)
*   **Trigger:** High volume of leads (exceeding plan).
*   **Action:** `BillingGuard` intercepts processing.
*   **Expected:** Processing blocked or warned based on policy.
*   **Criticality:** 💰 **Revenue**.

### 7. Manager Scorecard View (Manager)
*   **Trigger:** Manager logs into `apps/manager-ui`.
*   **Action:** View Team Dashboard.
*   **Expected:** Aggregated metrics (Leads, Conversion %) displayed correctly.
*   **Criticality:** 📉 **Medium** (Reporting).

### 8. Routing Policy Update (TenantAdmin)
*   **Trigger:** Admin commits change to `channel-routing-policy.yaml`.
*   **Action:** CI/CD deploys new config.
*   **Expected:** New routing logic applies to *new* leads immediately.
*   **Criticality:** ⚙️ **Medium** (Ops).

### 9. Token Rotation (TenantAdmin/System)
*   **Trigger:** OAuth Token expiration or Manual Rotation.
*   **Action:** `TokenVault` refreshes token.
*   **Expected:** Integration continues without downtime.
*   **Criticality:** 🔒 **High** (Security).

### 10. Audit Log Inspection (TenantAdmin/Compliance)
*   **Trigger:** Request for lead history.
*   **Action:** Query Event Store for `lead_id`.
*   **Expected:** Complete timeline of Ingest -> Score -> Route -> Execute.
*   **Criticality:** 🛡️ **Medium** (Trust).
