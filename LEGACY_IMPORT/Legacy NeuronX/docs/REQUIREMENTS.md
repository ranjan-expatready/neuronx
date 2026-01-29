# NeuronX Requirements Contract

**Version:** 1.0
**Status:** Canonical Contract (Enforceable)
**Last Updated:** 2026-01-03
**Authority:** Derived from ADRs 0002, 0003, 0007 and vendor boundary policy

## 1. Scope & Non-Goals

### In Scope (Enforceable)

- REQ-001: NeuronX MUST provide AI-driven sales orchestration as core intelligence layer
  - Acceptance:
    - (A1) Lead scoring algorithms achieve >85% accuracy vs manual assessment
    - (A2) Predictive routing reduces assignment errors by >20%
  - Traceability (initial):
    - Code: apps/core-api/src/sales/
    - Tests: apps/core-api/src/sales/**tests**/
    - Evidence: docs/EVIDENCE/phase4b_feature1_output.txt

- REQ-002: NeuronX MUST orchestrate multi-channel execution through adapters
  - Acceptance:
    - (A1) Support SMS, email, and webhook execution channels
    - (A2) Maintain <5 second orchestration latency for critical paths
  - Traceability (initial):
    - Code: packages/adapters/
    - Tests: tests/contract/ghl-adapter.contract.spec.ts
    - Evidence: docs/EVIDENCE/phase4c_performance_profiling.txt

### Out of Scope (Prohibited)

- REQ-003: NeuronX MUST NOT implement custom user interfaces or front-end frameworks
  - Acceptance:
    - (A1) No UI components in NeuronX codebase
    - (A2) All UI execution delegated to external platforms
  - Traceability (initial):
    - Code: N/A (prohibition)
    - Tests: TBD
    - Evidence: TBD

- REQ-004: NeuronX MUST NOT manage physical infrastructure or database administration
  - Acceptance:
    - (A1) No server management or backup procedures in NeuronX
    - (A2) Database operations limited to application-level queries
  - Traceability (initial):
    - Code: N/A (prohibition)
    - Tests: TBD
    - Evidence: TBD

## 2. Definitions

- **Tenant**: Top-level organizational container (agency) with isolated data and configurations
- **Adapter**: Stateless protocol translation layer between NeuronX and external execution platforms
- **Execution Platform**: External systems (GHL, Salesforce) that handle UI, storage, and communication delivery
- **System of Record**: NeuronX as authoritative source for business logic, state, and audit trails
- **Event**: Immutable fact representing state change, stored with full context and timestamp
- **Stage Gate**: Business rule checkpoint requiring explicit approval before progression
- **CaseOpen**: OUTSIDE PDF - Not defined in provided Sales OS Playbook
- **PAID**: OUTSIDE PDF - Not defined in provided Sales OS Playbook
- **Consent**: OUTSIDE PDF - Not defined in provided Sales OS Playbook

## 3. IP Boundary Contract

### Non-Negotiable NeuronX IP (Enforceable)

- REQ-005: NeuronX MUST own all business rules, scoring algorithms, and decision logic
  - Acceptance:
    - (A1) No business logic implemented in external platform workflows
    - (A2) All scoring calculations performed in NeuronX core
  - Traceability (initial):
    - Code: apps/core-api/src/sales/
    - Tests: tests/unit/advanced-scoring.service.spec.ts
    - Evidence: docs/EVIDENCE/phase4b_feature1_output.txt

- REQ-006: NeuronX MUST own AI models, predictive algorithms, and analytics pipelines
  - Acceptance:
    - (A1) ML models execute within NeuronX boundaries
    - (A2) Prediction results never cached or computed externally
  - Traceability (initial):
    - Code: apps/core-api/src/cipher/
    - Tests: apps/core-api/src/cipher/**tests**/
    - Evidence: docs/EVIDENCE/phase4b_cipher_monitor.txt

### Adapter Execution Contract (Enforceable)

- REQ-007: Adapters MUST contain only protocol translation and stateless execution commands
  - Acceptance:
    - (A1) No decision logic, branching, or state management in adapters
    - (A2) GHL workflow triggers treated as dumb execution actions only
    - (A3) Exception waivers require ADR documentation and explicit approval
  - Traceability (initial):
    - Code: packages/adapters/
    - Tests: tests/contract/ghl-adapter.contract.spec.ts
    - Evidence: docs/EVIDENCE/phase4a_slice1_e2e.txt

### Forbidden Logic Placement (Enforceable)

- REQ-008: NeuronX MUST NOT implement decision logic, branching logic, or timers in external platforms
  - Acceptance:
    - (A1) GHL workflows contain only execution steps, no business rules
    - (A2) All SLA calculations and escalations managed in NeuronX
    - (A3) External platform changes do not affect NeuronX business logic
  - Traceability (initial):
    - Code: N/A (enforcement via .cursor/rules/)
    - Tests: tests/contract/ghl-adapter.contract.spec.ts
    - Evidence: TBD

## 4. Canonical Domain Model

**OUTSIDE PDF** - Sales OS Playbook does not contain explicit canonical object definitions. Derived from existing ADRs and implementation:

### Required Entities

- **Lead/Contact**: Customer profile with scoring, qualification status, and assignment history
- **Opportunity**: Sales deal with pipeline stage, value, and contact association
- **Tenant**: Organizational container with configuration and user management
- **Event**: Immutable audit trail entry with full context and metadata

### Required Relationships

- Lead → Opportunity (1:many, qualification creates opportunities)
- Tenant → Leads (1:many, data isolation boundary)
- Tenant → Opportunities (1:many, data isolation boundary)
- Event → All Entities (audit trail linkage)

## 5. Lifecycle State Machine & Stage Gates

**OUTSIDE PDF** - Sales OS Playbook does not contain explicit stage gate definitions. Derived from implementation:

### Lead Lifecycle States

1. **Created** → **Qualified** (gate: scoring > threshold)
2. **Qualified** → **Routed** (gate: team assignment logic)
3. **Routed** → **Engaged** (gate: first contact interaction)
4. **Engaged** → **Converted** (gate: opportunity creation)

### Opportunity Lifecycle States

1. **Created** → **Active** (gate: pipeline assignment)
2. **Active** → **Won/Lost** (gate: manual or SLA-based closure)

## 6. Eventing & Auditability Contract

- REQ-009: NeuronX MUST maintain canonical audit trail: "if it's not in the system, it didn't happen"
  - Acceptance:
    - (A1) All business events stored with immutable timestamps
    - (A2) Event sourcing enables complete state reconstruction
    - (A3) Audit trail survives external platform failures
  - Traceability (initial):
    - Code: apps/core-api/src/audit/
    - Tests: apps/core-api/src/sla/**tests**/
    - Evidence: docs/EVIDENCE/phase4b_feature2_output.txt

- REQ-010: NeuronX MUST recompute all calculated values from authoritative source data
  - Acceptance:
    - (A1) Lead scores recalculated from raw contact data
    - (A2) Analytics derived from event store, not cached external values
    - (A3) Business rules applied consistently regardless of external state
  - Traceability (initial):
    - Code: apps/core-api/src/sales/
    - Tests: tests/unit/advanced-scoring.service.spec.ts
    - Evidence: docs/EVIDENCE/phase4b_cipher_monitor.txt

## 7. Integrations Contract

- REQ-011: NeuronX MUST use GHL as execution layer only (ADR 0002)
  - Acceptance:
    - (A1) GHL handles UI rendering and data persistence
    - (A2) NeuronX provides orchestration intelligence via adapters
    - (A3) GHL workflows triggered as execution commands only
  - Traceability (initial):
    - Code: apps/core-api/src/integrations/ghl/
    - Tests: tests/contract/ghl-adapter.contract.spec.ts
    - Evidence: docs/EVIDENCE/phase3a2_capture_webhook_headers.md

- REQ-012: NeuronX MUST implement adapter-first integration pattern (ADR 0007)
  - Acceptance:
    - (A1) All external integrations go through stateless adapters
    - (A2) Adapter contracts prevent vendor logic leakage
    - (A3) Adapters support multiple execution platforms
  - Traceability (initial):
    - Code: packages/adapters/
    - Tests: tests/contract/ghl-adapter.contract.spec.ts
    - Evidence: docs/EVIDENCE/phase4a_slice2_e2e.txt

## 8. Multi-Tenancy Contract

- REQ-013: NeuronX MUST enforce tenant isolation using single database with tenant_id (TENANT_MODEL.md)
  - Acceptance:
    - (A1) All queries filtered by tenant_id at database level
    - (A2) Row-level security prevents cross-tenant data access
    - (A3) Tenant-specific configurations remain isolated
  - Traceability (initial):
    - Code: apps/core-api/src/ (tenant filtering)
    - Tests: TBD
    - Evidence: docs/EVIDENCE/phase4a_architecture_boundaries.txt

- REQ-014: NeuronX MUST support agency-level and location-specific operations
  - Acceptance:
    - (A1) Company tokens grant agency-wide access
    - (A2) Location tokens restrict access to specific sub-accounts
    - (A3) User permissions respect hierarchical access control
  - Traceability (initial):
    - Code: packages/security/token-vault/
    - Tests: TBD
    - Evidence: TBD

## 9. Security & Safety Contract

- REQ-015: NeuronX MUST validate all webhook signatures and implement idempotency
  - Acceptance:
    - (A1) HMAC-SHA256 signature verification on all webhooks
    - (A2) Idempotent processing prevents duplicate event handling
    - (A3) Failed signature validation blocks processing
  - Traceability (initial):
    - Code: packages/webhooks/
    - Tests: apps/core-api/src/integrations/ghl/**tests**/ghl-webhook.controller.spec.ts
    - Evidence: docs/EVIDENCE/phase3a2_capture_webhook_headers.md

- REQ-016: NeuronX MUST implement secure token lifecycle management
  - Acceptance:
    - (A1) Access tokens expire within 1 hour maximum
    - (A2) Refresh tokens support automatic renewal
    - (A3) Token storage encrypted and access-controlled
  - Traceability (initial):
    - Code: packages/security/token-vault/
    - Tests: TBD
    - Evidence: docs/EVIDENCE/phase3a1_oauth_callback_flow.txt

## 10. Testing & Evidence Contract

- REQ-017: NeuronX MUST maintain 85%+ code coverage across unit, integration, and E2E tests
  - Acceptance:
    - (A1) Unit tests cover business logic with >85% coverage
    - (A2) Integration tests validate component interactions
    - (A3) E2E tests cover critical user journeys
  - Traceability (initial):
    - Code: N/A (test infrastructure)
    - Tests: vitest.config.ts, playwright.config.ts
    - Evidence: docs/EVIDENCE/phase4c_performance_profiling.txt

- REQ-018: NeuronX MUST enforce adapter contract boundaries through automated testing
  - Acceptance:
    - (A1) Contract tests validate interface compliance
    - (A2) No vendor types leak into core business logic
    - (A3) Adapter boundaries enforced by CI/CD
  - Traceability (initial):
    - Code: N/A (test enforcement)
    - Tests: tests/contract/ghl-adapter.contract.spec.ts
    - Evidence: docs/EVIDENCE/phase4a_slice1_e2e.txt

- REQ-019: NeuronX MUST treat configuration as first-class intellectual property (ADR-0010)
  - Acceptance:
    - (A1) Configuration schema owned by NeuronX, not tenants
    - (A2) All configuration changes require evidence artifacts
    - (A3) Configuration validation tests maintain >90% coverage
    - (A4) Configuration changes subject to CI drift validation
  - Traceability (initial):
    - Code: apps/core-api/src/config/
    - Tests: apps/core-api/src/config/**tests**/config.validation.spec.ts
    - Evidence: docs/EVIDENCE/configuration/

- REQ-RATE: NeuronX MUST implement tenant-aware rate limiting for API and webhook endpoints
  - Acceptance:
    - (A1) Rate limits enforced per tenant with token bucket algorithm
    - (A2) Different scopes (api/webhook/admin) have separate limits
    - (A3) Tier-aware policies (free/starter/professional/enterprise)
    - (A4) Explicit fail-open/fail-closed semantics with security context
    - (A5) Webhook signature verification runs before expensive processing
    - (A6) Rate limiting applied early but after tenant resolution
    - (A7) Proper HTTP 429 responses with retry-after headers
    - (A8) Tenant isolation prevents cross-tenant rate limit pollution
  - Traceability (initial):
    - Code: apps/core-api/src/rate-limit/
    - Tests: apps/core-api/src/rate-limit/**tests**/rate-limit.guard.spec.ts
    - Evidence: docs/EVIDENCE/rate-limit/

## 11. Traceability Matrix

| Requirement ID | Section          | Code Path(s)                          | Test(s)                                       | Evidence Artifact                                 |
| -------------- | ---------------- | ------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| REQ-001        | 1. Scope         | apps/core-api/src/sales/              | apps/core-api/src/sales/**tests**/            | docs/EVIDENCE/phase4b_feature1_output.txt         |
| REQ-005        | 3. IP Boundary   | apps/core-api/src/sales/              | tests/unit/advanced-scoring.service.spec.ts   | docs/EVIDENCE/phase4b_feature1_output.txt         |
| REQ-007        | 3. IP Boundary   | packages/adapters/                    | tests/contract/ghl-adapter.contract.spec.ts   | docs/EVIDENCE/phase4a_slice1_e2e.txt              |
| REQ-009        | 6. Eventing      | apps/core-api/src/audit/              | apps/core-api/src/sla/**tests**/              | docs/EVIDENCE/phase4b_feature2_output.txt         |
| REQ-011        | 7. Integrations  | apps/core-api/src/integrations/ghl/   | tests/contract/ghl-adapter.contract.spec.ts   | docs/EVIDENCE/phase3a2_capture_webhook_headers.md |
| REQ-013        | 8. Multi-Tenancy | apps/core-api/src/ (tenant filtering) | TBD                                           | docs/EVIDENCE/phase4a_architecture_boundaries.txt |
| REQ-015        | 9. Security      | packages/webhooks/                    | apps/core-api/src/integrations/ghl/**tests**/ | docs/EVIDENCE/phase3a2_capture_webhook_headers.md |
| REQ-017        | 10. Testing      | N/A (test infra)                      | vitest.config.ts                              | docs/EVIDENCE/phase4c_performance_profiling.txt   |
| REQ-018        | 10. Testing      | N/A (test enforcement)                | tests/contract/ghl-adapter.contract.spec.ts   | docs/EVIDENCE/phase4a_slice1_e2e.txt              |
| REQ-019        | 2. Definitions   | N/A (config infra)                    | TBD                                           | docs/EVIDENCE/configuration/                      |
