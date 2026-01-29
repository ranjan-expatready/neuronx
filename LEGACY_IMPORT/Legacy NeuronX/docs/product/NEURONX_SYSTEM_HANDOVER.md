# NeuronX System Handover Dossier

**Status**: LIVE | **Version**: 1.0.0 | **Date**: 2026-01-26
**Target Audience**: Autonomous Agents & Engineering Leadership
**SSOT Enforcement**: All claims backed by repository evidence.

---

## 1. Executive Overview

NeuronX is the **Intelligence Layer** for high-volume sales operations. It decouples business logic from execution platforms (like GoHighLevel), ensuring that scoring, routing, and decision-making are centralized, auditable, and platform-agnostic.

**The "One Truth":** NeuronX owns the *decision* (Who gets the lead? Is it qualified?); External platforms own the *action* (Send SMS, Place Call).

---

## 2. Product Truth (Role: Product Owner)

### Canonical Product Definition
NeuronX is a **multi-tenant Sales Orchestration Platform** that ingests leads, evaluates them against deterministic rules, and routes them to the best available agent or workflow. It is *not* a CRM; it is the engine that drives the CRM.

**Sources**: [`docs/SSOT/01_MISSION.md`](docs/SSOT/01_MISSION.md), [`docs/product/01_FEATURE_CATALOG.md`](docs/product/01_FEATURE_CATALOG.md)

### User Roles & Hierarchy
Defined in [`packages/org-authority/src/types.ts`](packages/org-authority/src/types.ts):
1.  **ENTERPRISE_ADMIN**: Cross-agency control.
2.  **AGENCY_ADMIN**: Configures scoring/routing for a specific agency.
3.  **TEAM_LEAD**: Approves high-risk actions, manages queues.
4.  **OPERATOR**: Human agent executing tasks (calls/manual review).
5.  **VIEWER/AUDITOR**: Read-only compliance access.

### Feature Truth Table

| Feature | Status | Evidence |
| :--- | :--- | :--- |
| **Sales Orchestration** | **LIVE** | [`apps/core-api/src/domain/sales`](apps/core-api/src/domain/sales) |
| **Lead Scoring** | **LIVE** | `LeadScorerService` (>85% accuracy target) |
| **GHL Adapter** | **LIVE** | [`packages/ghl-read-adapter`](packages/ghl-read-adapter) |
| **Multi-Tenancy** | **LIVE** | Database Schema (`tenantId` column) |
| **Voice Agents** | *PLANNED* | Epic-07 |
| **Config Marketplace** | *PLANNED* | Epic-08 |
| **Control Plane** | *PLANNED* | Epic-09 |

### 10 Golden User Journeys
Defined in [`docs/product/02_GOLDEN_USE_CASES.md`](docs/product/02_GOLDEN_USE_CASES.md) and verified by [`tests/e2e/specs/journey-proof-pack.spec.ts`](tests/e2e/specs/journey-proof-pack.spec.ts):
1.  **Inbound Lead Ingestion**: Webhook → NeuronX Lead Created.
2.  **Auto-Qualification**: Lead → Scored (Qualified/Unqualified).
3.  **High-Value Routing**: VIP Lead → Specific Senior Agent.
4.  **Work Queue Assignment**: Lead → Operator's Queue.
5.  **Operator Manual Approval**: Operator reviews & approves action.
6.  **SLA Breach**: System detects delay → Re-routes lead.
7.  **Agency Onboarding**: Admin creates new Agency tenant.
8.  **Token Rotation**: Security system rotates API keys.
9.  **Audit Log Retrieval**: Auditor fetches history for a lead.
10. **Billing Limit Enforcement**: System blocks action due to quota.

**What NOT to Build**:
- **CRM UI**: Use GHL/Salesforce.
- **Telephony**: Use Twilio/GHL.
- **Email Sending**: Use Mailgun/GHL.

---

## 3. Architecture Truth (Role: Chief Architect)

### System Boundaries
- **NeuronX (In-Scope)**: Business Rules, State, Scoring, Routing, SLAs, Audit.
- **External (Out-of-Scope)**: UI Rendering, Message Delivery, Telephony Infrastructure.

### Runtime Architecture
The system is a **Modular Monolith** with a strict Event-Driven Architecture (EDA).

**Diagram (Textual)**:
```
[External CRM (GHL)] --(Webhook)--> [Adapter Layer]
                                          |
                                    (Normalized Event)
                                          v
[Core API] <--(Event Bus)--> [Domain Services (Sales, Scoring)]
    |                                     |
    +--(Prisma)--> [PostgreSQL]           |
    |                                     |
    +--(Outbox)--> [Command Generator]    |
                          |               |
                    (Command Event)       |
                          v               |
[Adapter Layer] --(API Call)--> [External CRM]
```

### Critical Architectural Patterns
1.  **Event Sourcing Lite**: State is reconstructed from immutable events in the `Event` table.
    -   Source: [`apps/core-api/src/eventing`](apps/core-api/src/eventing)
2.  **Outbox Pattern**: All side effects (webhooks, API calls) are stored in `EventOutbox` within the database transaction to guarantee delivery.
    -   Source: [`durable-event-publisher.ts`](apps/core-api/src/eventing/durable-event-publisher.ts)
3.  **Tenant Isolation**: **MANDATORY** `tenantId` on all primary tables (`Lead`, `Opportunity`, `Config`).
    -   Source: [`apps/core-api/prisma/schema.prisma`](apps/core-api/prisma/schema.prisma)

### Trust Boundaries
-   **Adapters are Untrusted**: They must validate all external input (signatures, payload schemas) before passing data to Core.
-   **Core is Trusted**: Assumes valid, normalized data from Adapters.
-   **Database is Private**: No external access allowed; only via Core API.

---

## 4. Quality & Test Contract (Role: QA / Release Captain)

### Test Pyramid
Strictly enforced distribution defined in [`docs/SSOT/04_TEST_STRATEGY.md`](docs/SSOT/04_TEST_STRATEGY.md):
-   **Unit (70%)**: Business logic, rules engines. (`tests/unit`)
-   **Contract (20%)**: Adapter interfaces, API schemas. (`tests/contract`)
-   **E2E (10%)**: Critical "Golden Journeys" only. (`tests/e2e`)

### The "Green" Standard
A build is only "Green" if it passes [`scripts/verify-readiness.sh`](scripts/verify-readiness.sh):
1.  **Node/Deps**: Version match.
2.  **Prisma**: Client generated.
3.  **Static**: Linting (ESLint) + Types (TSC) clean.
4.  **Build**: `pnpm build` succeeds for all workspaces.
5.  **Unit Tests**: All core tests pass.
6.  **Quarantine**: No *new* tests in quarantine.

### Regression Prevention
-   **Traceability**: Every feature must map to a test case in `docs/TRACEABILITY.md`.
-   **CI Gates**: GitHub Actions block PRs with <85% coverage or failing "Golden Journeys".
-   **Stop-Ships**: Security regressions (secret leaks) immediately halt the pipeline.

---

## 5. Security & Risk (Role: Security Officer)

### Auth Model
-   **TokenVault**: Custom secure storage for OAuth tokens (`accessToken`, `refreshToken`).
    -   Source: [`packages/security/token-vault`](packages/security/token-vault)
-   **Encryption**: **AES-256-GCM** with Envelope Encryption (Master Key -> KEK -> DEK -> Data).
    -   Source: [`packages/security/token-vault/crypto.ts`](packages/security/token-vault/crypto.ts)

### RBAC
-   **Scope-Based**: Permissions defined by OAuth scopes stored in `TokenRecord`.
-   **Enforcement**: Application layer checks scopes before executing Commands.

### Threat Model
1.  **Billing Abuse**: Gaming quotas, concurrent request attacks.
    -   Mitigation: `EntitlementEvaluator` (Block/Monitor modes).
2.  **Secret Leakage**: Hardcoded keys in code/logs.
    -   Mitigation: `secret-leakage-regression-net` scan in CI.
3.  **Spoofed Webhooks**: Fake data from external sources.
    -   Mitigation: Mandatory HMAC signature verification in Adapters.

**Non-Negotiables**:
-   **NEVER** log `accessToken`, `refreshToken`, or PII.
-   **NEVER** bypass `tenantId` checks in DB queries.

---

## 6. Engineering Operating Manual (Role: Engineering Manager)

### Monorepo Structure
-   **Package Manager**: `pnpm` (Workspace mode).
-   **Apps**: `apps/core-api` (Backend), `apps/operator-ui` (Frontend - *Stub/Minimal*).
-   **Packages**: `packages/security`, `packages/adapters`, `packages/ghl-read-adapter`.

### Bootstrapping
1.  **Clone**: `git clone ...`
2.  **Setup**: Run [`scripts/setup-dev.sh`](scripts/setup-dev.sh)
    -   Installs Node (via nvm), pnpm, dependencies.
3.  **Env**: Copy `.env.example` to `.env`.

### Development Workflow
Follow [`FACTORY_PLAYBOOK.md`](FACTORY_PLAYBOOK.md):
1.  **Spec Mode**: If touching >2 files, create a spec in `.factory/docs/`.
2.  **Vertical Slice**: Implement End-to-End (Database -> API -> Test).
3.  **Verify**: Run `scripts/verify-readiness.sh` locally.

### Debugging
-   **Logs**: Check `agent_runtime/evidence/` for agent interaction logs.
-   **Rate Limits**: See `docs/EVIDENCE/rate-limit/` for 429 vs 401 diagnosis.
-   **Missing Config**: If readiness fails RED, check `.env` variables.

---

## 7. What Must Never Be Broken
1.  **Data Integrity**: Never lose a Lead or Event. (Event Sourcing).
2.  **Tenant Isolation**: Never leak data between Agencies.
3.  **Billing Gates**: Never allow unpaid usage (unless in Monitor mode).
4.  **Security**: Never commit secrets.

## 8. Where the Value Comes From
The "Product" is the **Rules Engine** and the **Data Graph**. The UI is secondary. The value is in the *decision* that "Lead X is worth $500 and should go to Agent Y immediately," not in the text message sent to Agent Y.

---

## 9. Contradictions & Reality Checks (Auto-Generated)

After validating this dossier against the codebase (as of 2026-01-26), the following contradictions were found:

1.  **Operator UI Status**: The dossier lists `apps/operator-ui` as "*Stub/Minimal*", but the directory contains a full Next.js application with `OperatorConsole` and `WorkQueuePanel` components.
2.  **Voice Agent Readiness**: Listed as "Planned/Future", but significant foundational code (`voice.policy.ts`, `voice-orchestration.engine.ts`) already exists in `packages/voice-orchestration`, suggesting it is partially implemented (hidden behind feature flags).
3.  **Lead Scoring "Accuracy"**: The ">85%" accuracy is a **Requirement/Heuristic**, not an ML result. `REALITY_VS_INTENT.md` clarifies that scoring is "Currently 100% heuristic. No ML model inference."
4.  **Admin UI**: While no "Admin UI" exists (as claimed), there are `apps/manager-ui` and `apps/executive-ui` which provide UI surfaces for non-Operator roles, which should be distinguished from "Config Admin".

---

**End of Dossier**
