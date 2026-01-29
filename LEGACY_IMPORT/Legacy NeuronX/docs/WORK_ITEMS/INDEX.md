# Work Items Index

**Purpose:** Track all work items for NeuronX development with status, priority, and traceability.

## Active Work Items

| WI-ID  | Title                                                     | Status                                                            | Priority     | Created      | Assigned                           | Related Requirements                        |
| ------ | --------------------------------------------------------- | ----------------------------------------------------------------- | ------------ | ------------ | ---------------------------------- | ------------------------------------------- | ----------------------------------------------------------- | -------------------------- | ------ | ------------------------------------------------------ | --------------------------------------------------- | ------------ | ------------ | ---------- | ------------ | ------------------------- | ------ | ----------------------------------------------- | ------------ | -------------------------------------- | ------------ | ------------ | ---------- | ----------------------------------------------------------- | ------- | ------------------------------------------ |
| WI-001 | Canonical Field Contracts                                 | ✅ Completed                                                      | Critical     | 2026-01-03   | Cursor Agent                       | REQ-001, REQ-005, REQ-007, REQ-009, REQ-013 |
| WI-002 | Canonical Sales OS Playbook Extraction                    | ✅ Completed                                                      | Critical     | 2026-01-03   | Cursor Agent                       | All Requirements (validation)               |
| WI-003 | Consent, Compliance & Legal Safety                        | ✅ Completed                                                      | Critical     | 2026-01-03   | Cursor Agent                       | REQ-001, REQ-007, REQ-019                   |
| WI-004 | Voice Platform Boundary Hardening                         | ✅ Completed                                                      | Critical     | 2026-01-03   | Cursor Agent                       | REQ-001, REQ-007, REQ-019                   |
| WI-005 | Monetization & Usage Contract Completion                  | ✅ Completed                                                      | Critical     | 2026-01-03   | Cursor Agent                       | REQ-001, REQ-019                            |
| WI-006 | Admin Control Plane (Governance Only)                     | ✅ Completed                                                      | Critical     | 2026-01-03   | Cursor Agent                       | REQ-001, REQ-007, REQ-019                   |
|        | WI-007                                                    | Production Persistence Inventory                                  | ✅ Completed | Critical     | 2026-01-03                         | Cursor Agent                                | REQ-001, REQ-007, REQ-019                                   |                            |        | WI-007                                                 | Sales/GTM Public API Contracts                      | ✅ Completed | High         | 2026-01-03 | Cursor Agent | REQ-001, REQ-007, REQ-019 |
|        | WI-008                                                    | Distributed Rate Limiting (Redis)                                 | ✅ Completed | High         | 2026-01-03                         | Cursor Agent                                | REQ-RATE                                                    | ## Work Item Status Legend |
|        | WI-009                                                    | Usage Persistence (Production-grade, queryable)                   | ✅ Completed | Critical     | 2026-01-04                         | Cursor Agent                                | REQ-019                                                     |                            |        | WI-010                                                 | Entitlement Persistence (PostgreSQL, authoritative) | ✅ Completed | Critical     | 2026-01-03 | Cursor Agent | REQ-019                   |        |                                                 | WI-011       | Payment Persistence (PostgreSQL, ACID) | ✅ Completed | Critical     | 2026-01-03 | Cursor Agent                                                | REQ-001 | - **🟢 Active:** Currently being worked on |
|        | WI-017                                                    | SLA Timer Persistence (Production-grade)                          | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     |                                                             |                            | WI-014 | Durable Event Streaming (Replace any InMemoryEventBus) | ✅ Completed                                        | 2026-01-04   | Cursor Agent | REQ-001    |              |                           | WI-012 | Configuration Persistence (PostgreSQL, IP-safe) | ✅ Completed | Critical                               | 2026-01-03   | Cursor Agent | REQ-019    | - **✅ Completed:** Finished with evidence and traceability |
|        | WI-013                                                    | Voice State Persistence (PostgreSQL, multi-instance safe)         | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **⏸️ Paused:** Temporarily halted, can be resumed         |
|        | WI-015                                                    | ML/Scoring Cache Cluster (Redis) + Deterministic Cache Governance | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **❌ Cancelled:** No longer needed                        |
|        | WI-018                                                    | Outbound Webhook Delivery System (Production-grade)               | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **🔄 Pending:** Ready to start but not yet active         |
|        | WI-019                                                    | Secrets & Encryption Foundation                                   | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     |
|        | WI-020                                                    | Webhook Endpoint Management APIs                                  | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | ## Priority Levels                                          |
|        | WI-021                                                    | Object Storage & Artifact Management                              | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **Critical:** Blocks other work or fundamental to product |
|        | WI-022                                                    | Access Control & API Key Governance                               | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **High:** Important for current milestone                 |
|        | WI-023                                                    | Data Retention & Cleanup Runners                                  | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **Medium:** Should be done soon                           |
|        | WI-024                                                    | Observability & Metrics Foundation                                | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     | - **Low:** Nice to have, backlog items                      |
|        | WI-025                                                    | Grafana Dashboards + Prometheus Alerts                            | ✅ Completed | 2026-01-04   | Cursor Agent                       | REQ-001                                     |
|        | WI-026                                                    | Release & Environment Hardening                                   | ✅ Completed | 2026-01-05   | Cursor Agent                       | REQ-001                                     |
|        | WI-027                                                    | Canonical Sales State Machine                                     | ✅ Completed | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-005, REQ-007, REQ-008          |
| WI-028 | Adapter-First Execution Layer                             | ✅ Completed                                                      | 2026-01-05   | Cursor Agent | REQ-002, REQ-008, REQ-011, REQ-012 |
|        | WI-028                                                    | Authoritative Playbook Engine (Playbook-as-Code)                  | ✅ Completed | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-005, REQ-007, REQ-008          |
|        | WI-029                                                    | Decision Engine & Actor Orchestration                             | ✅ Completed | Critical     | 2026-01-05                         | Cursor Agent                                | REQ-001, REQ-005, REQ-006, REQ-008, REQ-010, REQ-014        |
| WI-030 | Playbook Versioning & Governance                          | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-005, REQ-007, REQ-008          |
| WI-031 | Playbook Experimentation & Outcome Intelligence           | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-005, REQ-007, REQ-008          |
| WI-032 | Operator Control Plane (Authoritative, Minimal UI)        | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-005, REQ-007, REQ-008          |
| WI-033 | Voice Execution Adapter Hardening (Twilio-first)          | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-015, REQ-016          |
| WI-034 | Multi-Channel Execution Authority + Tokenized Actor Model | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-002, REQ-016, REQ-018                   |
| WI-035 | Tenant & Organization Authority Model                     | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-014, REQ-016, REQ-018                   |
| WI-036 | Production Identity & Principal Model                     | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-016, REQ-018                            |
| WI-037 | Opportunity → Team Binding                                | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-014, REQ-016, REQ-018                   |
| WI-038 | Org Admin + Integration Mapping Ops Pack                  | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-014, REQ-016, REQ-018                   |
| WI-039 | Customer Onboarding Golden Path                           | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-014                   |
| WI-040 | Billing & Entitlements Authority                          | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-014                   |
| WI-041 | GHL Billing → Entitlement Sync Adapter                    | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-014                   |
| WI-042 | Decision Policy Configuration                             | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-014                   |
| WI-043 | Channel Routing Policy Configuration                      | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-002, REQ-016, REQ-018                   |
| WI-044 | Billing Plan & Limit Configuration                        | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-014                   |
| WI-045 | GHL Product → Plan Mapping Hardening                      | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-014                   |
| WI-048 | GHL Capability Allow/Deny Matrix                          | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-002, REQ-016, REQ-018                   |
| WI-054 | Production Readiness Dashboard                            | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-001, REQ-002, REQ-007, REQ-012, REQ-019 |
| WI-061 | UI Infrastructure & Governance Layer                      | ✅ Completed                                                      | Critical     | 2026-01-06   | Cursor Agent                       | REQ-001, REQ-002, REQ-007, REQ-012, REQ-019 |
| WI-062 | Operator Console                                          | ✅ Completed                                                      | Critical     | 2026-01-06   | Cursor Agent                       | REQ-001, REQ-002, REQ-007, REQ-012, REQ-019 |
| WI-049 | GHL Snapshot Ingestion (Read-Only)                        | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-002, REQ-016, REQ-018                   |
| WI-053 | GHL Drift Detection Engine                                | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-002, REQ-016, REQ-018                   |
| WI-052 | Decision Explainability Engine                            | ✅ Completed                                                      | Critical     | 2026-01-05   | Cursor Agent                       | REQ-002, REQ-016, REQ-018                   | ## Work Item Categories                                     |

- **Documentation:** Requirements, architecture, contracts
- **Implementation:** Code development and integration
- **Testing:** Test creation and validation
- **Infrastructure:** DevOps, CI/CD, deployment
- **Research:** Investigation and analysis work

## Recent Activity

- **2026-01-03:** WI-001 completed - Created canonical field contracts for all 18 entities with comprehensive validation rules and gap analysis

## Upcoming Work Items (Proposed)

Based on WI-007 Production Persistence Inventory:

- **WI-008:** Distributed Rate Limiting (Redis) - Replace InMemoryRateLimitStore (Critical)
- **WI-009:** Usage Persistence (Time-Series DB) - Replace UsageService storage (Critical)
- **WI-010:** Entitlement Persistence (PostgreSQL) - Replace EntitlementService storage (Critical)
- **WI-011:** Payment Persistence (PostgreSQL) - Replace PaymentService storage (Critical)
- **WI-012:** Configuration Persistence (PostgreSQL) - Replace ConfigRepository storage (High)
- **WI-013:** Voice State Persistence (PostgreSQL) - Replace VoiceService attempt tracking (High)
- **WI-014:** Event Streaming Platform - Replace InMemoryEventBus (High)
- **WI-015:** ML Cache Cluster (Redis) - Replace AdvancedScoringService cache (Medium)
- **WI-016:** Template Persistence (PostgreSQL) - Replace TemplateService storage (Medium)
- **WI-017:** SLA Timer Persistence - Replace SLAService timer management (High)

## Work Item Template

All work items must follow the standard template:

```markdown
# WI-XXX: Title

**Status:** [Status]
**Created:** YYYY-MM-DD
**Priority:** [Priority]
**Assigned:** [Assignee]

## Problem Statement

[Clear description of the problem]

## Acceptance Criteria

- [ ] AC-001: [Criteria]
- [ ] AC-002: [Criteria]

## Artifacts Produced

- [ ] [Artifact description]

## Out of Scope

[What's explicitly not included]
```

## Governance Rules

- All work items must be traceable to requirements
- Work items must produce evidence artifacts
- Status must be updated when work begins/completes
- Priority must reflect business impact
- Dependencies must be clearly documented
