# Existing Product Map — NeuronX (Phase 0 Discovery)

## 1. User Roles & Personas
Derived from `apps/core-api/src/authz/authz.types.ts` and UI capabilities.

| Role | Type | Primary Interface | Key Capabilities |
| :--- | :--- | :--- | :--- |
| **TenantAdmin** | Human | API / Config Files | Full system control. Manages billing, team structure, and routing policies. Has `ADMIN_ALL` permission. |
| **Operator** | Human | `apps/operator-ui` | The "human-in-the-loop". Reviews leads, handles manual tasks, approves high-risk actions. |
| **Manager** | Human | `apps/manager-ui` | Views team performance, coaching metrics, and aggregate scorecards. |
| **ReadOnly** | Human | UI (Restricted) | Can view webhooks, artifacts, and usage data but cannot modify state. |
| **IntegrationBot** | System | API | Used by GHL/External systems for webhook ingestion and artifact uploads. |

## 2. Capability Map: What Can Be Done Today?

### A. Lead Management (The "Core Loop")
*   **Ingestion (Automatic):** Leads are ingested via `POST /api/v1/leads` or GHL Webhooks (`contact.created`).
*   **Scoring (Automatic):** Leads are scored immediately upon ingestion or update.
    *   *Reality:* Scoring is deterministic (rule-based), not AI.
    *   *Config:* Rules defined in `LeadScorerService`.
*   **Routing (Automatic):** Leads are assigned to teams/reps based on geography and rules.
    *   *Reality:* Static configuration matching (`channel-routing-policy.yaml`).
*   **Manual Review (Manual):** High-risk or low-confidence actions fall into the **Work Queue** for Operator review.

### B. Execution & Orchestration
*   **Channel Selection:** The system decides *how* to contact a lead (Voice, SMS, Email).
    *   *Logic:* Defined in `config/channel-routing-policy.yaml`. Priority: Voice > SMS > WhatsApp > Email.
    *   *Constraints:* "Critical" risk actions are forced to Email for human review.
*   **Billing Enforcement:** Every action is checked against the Tenant's plan (`BillingGuard`).
    *   *Status:* **Invisible** until a limit is hit (Block/Warning).
    *   *Plans:* Free, Pro, Enterprise (defined in `config/billing-policy.yaml`).

### C. Visibility & Governance
*   **Dashboards (Visible):**
    *   **Operator Console:** Work Queue, active tasks.
    *   **Manager Console:** Team scorecards, rep performance tables.
*   **Configuration (Hidden/Code-Level):**
    *   Most business logic (routing rules, billing limits) is controlled via YAML/JSON files in `config/`, not a UI settings page.

## 3. Journey Maps

### Journey 1: The Lead Lifecycle
1.  **Ingest:** Lead arrives from GHL Webhook.
2.  **Qualify:** System runs `LeadScorerService` (Rules: +80 Paid, +20 Enterprise).
3.  **Route:** System runs `LeadRouterService`.
    *   *If "North America"* → Route to `team-na`.
    *   *If "High Value"* (> $50k) → Prioritize WhatsApp.
4.  **Engage:** System attempts to execute action.
    *   *Check:* `BillingGuard` verifies quota.
    *   *Check:* `EntitlementEvaluator` approves/denies.
5.  **Outcome:**
    *   *Success:* Action executed via Adapter.
    *   *Failure/Risk:* Task created in `WorkQueue` for Operator.

### Journey 2: The Operator Workflow
1.  **Login:** Access `apps/operator-ui`.
2.  **Triage:** View `WorkQueuePanel` for pending tasks.
3.  **Review:** Open `DetailPanel` to see why a lead was flagged (e.g., "Risk Score > 80").
4.  **Act:** Approve or Reject the proposed action.
5.  **Monitor:** Check `ScorecardStrip` for personal metrics.

### Journey 3: The Manager Oversight
1.  **Login:** Access `apps/manager-ui`.
2.  **Assess:** View `TeamScorecardTable` to see Rep performance.
3.  **Drill Down:** Click into `RepDrilldownDrawer` for individual details.
4.  **Strategy:** (Currently Offline) Edit YAML config to change routing rules based on insights.
