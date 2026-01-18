# NeuronX – Master Backlog, Governance & Product Requirements

## Status: LOCKED

**Owner:** System (Founder-independent)  
**Purpose:** Prevent drift, duplication, hallucination  
**Rule:** Any work not listed here is unauthorized  
**Date:** January 5, 2026

---

## 1. EXECUTION GOVERNANCE (NON-NEGOTIABLE)

### Core Rules

- **One WI at a time**: No concurrent execution. Each WI must be completed with evidence before next begins.
- **No UI execution before EP-UI unlock**: UI remains in requirements-only state. No code, designs, or frameworks.
- **GHL = execution surface only**: GHL provides UI, payments, and execution plumbing. NeuronX owns authority, policy, audit, and decisions.
- **NeuronX = authority, policy, audit, decisions**: All business logic lives in NeuronX. GHL is stateless execution.
- **All logic must be policy-driven**: No hardcoded values. Everything configurable via YAML/JSON with schema validation.
- **Evidence required for every WI**: Each WI completion requires docs/EVIDENCE/ folder with test results and validation.
- **Cursor is execution-only, never scope-defining**: Cursor implements approved WIs only. No new requirements invented.

### Quality Standards

- **Enterprise-grade**: FAANG/consulting firm quality bar
- **Test coverage**: >90% for all packages
- **Deterministic behavior**: Same inputs produce identical outputs
- **Audit trail**: Every operation logged with correlation IDs
- **Performance bounded**: No unbounded operations or memory leaks
- **Security first**: All inputs validated, tenant isolation enforced

---

## 2. TRUTHFUL CURRENT STATE (NO FLUFF)

### What NeuronX Is Today

**Product Type:** Authoritative Sales OS backend - not a CRM, not a chatbot, not a workflow tool. A sovereign decision engine that orchestrates sales execution across multiple channels with enterprise governance.

**Backend:** Production-grade, enterprise-ready. Handles high-volume sales operations with policy-driven decisions, comprehensive audit trails, and multi-tenant isolation.

**UI:** NOT productized. No user interface exists. All interaction is API-only.

**Architecture State:**

- **Core Decision Engine:** Complete with risk assessment, actor selection, voice mode determination
- **Policy System:** Fully configurable YAML-based policies with runtime validation
- **GHL Integration:** Deep integration with read-only snapshots and drift detection
- **Authority Model:** Complete org hierarchy, team binding, capability enforcement
- **Billing Integration:** Read-only sync with GHL billing, entitlement enforcement
- **Explainability:** Structured decision explanations with complete factor attribution
- **Observability:** Comprehensive metrics, audit events, and performance monitoring

### What NeuronX Is NOT Yet

- **Customer-facing product**: No UI, no onboarding flow, no branding
- **Standalone application**: Requires GHL as execution surface
- **General-purpose CRM**: Highly specialized for sales orchestration
- **AI-first platform**: AI is one execution channel among many (human, voice, email, calendar)

### Readiness Assessment

- **Backend Core:** ~92% (decision engine, execution, storage, API)
- **Governance & Policy:** ~98% (authority, billing, capability control)
- **GHL Leverage:** ~85% (snapshots, drift detection, read-only integration)
- **Observability & Trust:** ~88% (explainability, audit, metrics)
- **UI / Product UX:** ~0% (by design - backend-first approach)

**Bottom Line:** NeuronX is a complete, enterprise-ready sales operating system backend. It can run production sales operations at scale with full governance. The missing piece is the user experience layer.

---

## 3. CANONICAL EP ROADMAP (LOCKED ORDER)

### EP-04: Configuration & Policy Hardening ✅ COMPLETED

**Focus:** Remove hardcoded logic, make everything policy-driven  
**Status:** All policies externalized, validated, versioned  
**WIs:** WI-042, WI-043, WI-044, WI-045

### EP-05: GHL Maximum Leverage 🚧 IN PROGRESS

**Focus:** Use GHL as execution surface without logic leakage  
**Status:** GHL capability control implemented, snapshots and drift detection complete  
**WIs:** WI-048, WI-049, WI-053

### EP-06: Operations, Observability & Trust 🚧 NEXT

**Focus:** Enterprise operations, monitoring, explainability, compliance  
**Status:** Decision explainability complete, need impact correlation and health dashboards  
**WIs:** WI-052, WI-054, WI-055, WI-056

### EP-07: Docs, Sales & Scale 🚧 FUTURE

**Focus:** Documentation, sales materials, scaling optimizations  
**Status:** Core docs complete, need sales enablement and performance optimization  
**WIs:** WI-057, WI-058, WI-059

### EP-UI: Product UI & Experience 🔒 BLOCKED

**Focus:** World-class operator experience and executive insights  
**Status:** Requirements locked, no execution allowed  
**WIs:** EP-UI-01 through EP-UI-08 (all BLOCKED)

---

## 4. MASTER WORK ITEM TABLE

| WI-ID    | Name                                                       | EP    | Priority | Status      | Depends On     | Produces                               | Notes                             |
| -------- | ---------------------------------------------------------- | ----- | -------- | ----------- | -------------- | -------------------------------------- | --------------------------------- |
| WI-027   | Canonical Sales State Machine + GHL Stage Validation       | EP-04 | Critical | DONE        | -              | packages/domain/models, GHL validation | Foundation for state authority    |
| WI-028   | Authoritative Playbook Engine (Playbook-as-Code)           | EP-04 | Critical | DONE        | WI-027         | packages/playbook-engine               | Deterministic sales orchestration |
| WI-029   | Decision Engine & Actor Orchestration                      | EP-04 | Critical | DONE        | WI-028         | packages/decision-engine               | Who executes and how              |
| WI-030   | Playbook Versioning & Governance                           | EP-04 | Critical | DONE        | WI-029         | packages/playbook-governance           | Immutable playbook evolution      |
| WI-031   | Playbook Experimentation & A/B Intelligence                | EP-04 | Critical | DONE        | WI-030         | packages/playbook-intelligence         | Measurable playbook improvement   |
| WI-032   | Operator Control Plane (Authoritative, Minimal UI)         | EP-UI | High     | BLOCKED     | WI-029         | apps/operator-ui                       | Read-only decision observation    |
| WI-033   | Execution Adapter Hardening (Voice-First)                  | EP-05 | Critical | DONE        | WI-029         | packages/adapters/voice-twilio         | Safe voice execution              |
| WI-034   | Multi-Channel Execution Authority + Tokenized Actor Model  | EP-04 | Critical | DONE        | WI-029         | packages/execution-authority           | Channel routing and tokens        |
| WI-035   | Tenant & Organization Authority Model                      | EP-04 | Critical | DONE        | WI-029         | packages/org-authority                 | Enterprise org hierarchy          |
| WI-036   | Production Identity & Principal Model                      | EP-04 | Critical | DONE        | WI-035         | Principal extraction                   | Real user identity                |
| WI-037   | Opportunity → Team Binding                                 | EP-04 | Critical | DONE        | WI-036         | Team resolution                        | Deterministic team assignment     |
| WI-038   | Org Admin + Integration Mapping Ops Pack                   | EP-04 | Critical | DONE        | WI-037         | Admin APIs + mapping                   | Org management                    |
| WI-039   | Customer Onboarding Golden Path                            | EP-07 | High     | DONE        | WI-038         | Bootstrap scripts                      | 60-minute onboarding              |
| WI-040   | Billing & Entitlements Authority                           | EP-04 | Critical | DONE        | WI-029         | packages/billing-entitlements          | Usage enforcement                 |
| WI-041   | GHL Billing → NeuronX Entitlement Sync (Read-Only Adapter) | EP-04 | Critical | DONE        | WI-040         | packages/adapters/ghl-billing          | Billing sync                      |
| WI-042   | Decision Policy Configuration                              | EP-04 | Critical | DONE        | WI-029         | config/decision-policy.yaml            | Externalized decision rules       |
| WI-043   | Channel Routing Policy Configuration                       | EP-04 | Critical | DONE        | WI-034         | config/channel-routing-policy.yaml     | Externalized routing rules        |
| WI-044   | Billing Plan & Limit Configuration                         | EP-04 | Critical | DONE        | WI-040         | config/billing-policy.yaml             | Externalized billing limits       |
| WI-045   | GHL Product → Plan Mapping Hardening                       | EP-04 | Critical | DONE        | WI-041         | config/plan-mapping-policy.yaml        | Plan mapping policy               |
| WI-048   | GHL Capability Allow / Deny Matrix                         | EP-05 | Critical | DONE        | WI-029         | config/ghl-capability-policy.yaml      | Capability control                |
| WI-049   | GHL Snapshot Ingestion (Read-Only)                         | EP-05 | Critical | DONE        | WI-048         | packages/ghl-snapshots                 | Configuration snapshots           |
| WI-052   | Decision Explainability Engine                             | EP-06 | Critical | DONE        | WI-029         | packages/decision-explainability       | Structured explanations           |
| WI-053   | GHL Drift Detection Engine                                 | EP-05 | Critical | DONE        | WI-049         | packages/ghl-drift                     | Configuration drift detection     |
| WI-054   | Drift → Policy Impact Correlator                           | EP-06 | High     | NOT STARTED | WI-053, WI-052 | Impact analysis engine                 | Connect drift to decisions        |
| WI-055   | Production Health Dashboard                                | EP-06 | High     | NOT STARTED | WI-053         | Health monitoring                      | System observability              |
| WI-056   | Enterprise Audit Trail Hardening                           | EP-06 | High     | NOT STARTED | WI-052         | Audit enhancements                     | Compliance audit system           |
| WI-057   | Sales Enablement Documentation                             | EP-07 | Medium   | NOT STARTED | All            | Sales materials                        | Customer-facing docs              |
| WI-058   | Performance & Scale Optimization                           | EP-07 | High     | NOT STARTED | WI-049         | Performance tuning                     | Production scaling                |
| WI-059   | Disaster Recovery & Backup                                 | EP-07 | Medium   | NOT STARTED | All            | Recovery procedures                    | Business continuity               |
| EP-UI-01 | Executive Scorecard Suite                                  | EP-UI | High     | BLOCKED     | EP-06 complete | CEO/CMO dashboards                     | Revenue, conversion, risk metrics |
| EP-UI-02 | Operator Task Queue & Execution UI                         | EP-UI | Critical | BLOCKED     | EP-06 complete | Task management                        | Daily operator workflow           |
| EP-UI-03 | Decision Explanation Viewer                                | EP-UI | High     | BLOCKED     | WI-052         | Explanation UI                         | Why decisions happened            |
| EP-UI-04 | Drift Impact Visualization                                 | EP-UI | Medium   | BLOCKED     | WI-054         | Drift dashboard                        | Configuration change impact       |
| EP-UI-05 | Org Management & User Administration                       | EP-UI | Medium   | BLOCKED     | WI-038         | Admin interface                        | Team and user management          |
| EP-UI-06 | Billing & Entitlement Monitoring                           | EP-UI | Medium   | BLOCKED     | WI-040         | Billing dashboard                      | Usage and limits                  |
| EP-UI-07 | System Health & Alert Dashboard                            | EP-UI | High     | BLOCKED     | WI-055         | Health monitoring UI                   | System observability              |
| EP-UI-08 | Audit & Compliance Viewer                                  | EP-UI | Medium   | BLOCKED     | WI-056         | Audit interface                        | Compliance reporting              |

---

## 5. 🔒 EP-UI — WORLD-CLASS UI REQUIREMENTS (REQUIREMENTS ONLY)

### 5.1 UI PHILOSOPHY

UI is a "Flight Deck", not a CRUD app. Humans execute system decisions, never replace them. UI explains decisions, never overrides them. No free-form overrides without audit. Designed for average operators (10th-standard safety). UI surfaces system intelligence, guides human action, enforces boundaries.

### 5.2 CORE UI PERSONAS

**Operator (Setter / Closer):** Daily task execution with clear boundaries and guidance  
**Team Lead:** Monitor team performance, approve escalations, view rep activity  
**Sales Manager:** Pipeline oversight, conversion tracking, team optimization  
**Agency Owner:** Multi-team management, billing oversight, performance analytics  
**CMO:** Channel performance, lead quality, campaign effectiveness, cost efficiency  
**CEO:** Revenue velocity, funnel health, conversion efficiency, risk exposure, SLA breaches  
**RevOps / Compliance:** Audit trails, system health, compliance reporting, configuration drift

### 5.3 EXECUTIVE SCORECARDS (REQUIREMENTS)

#### CEO Scorecard

- Revenue velocity (daily/weekly/monthly trends)
- Funnel health (conversion rates by stage)
- Conversion efficiency (booking to close ratios)
- Risk exposure (high-risk deal count, AI decision confidence)
- SLA breaches (response times, completion rates)
- AI vs Human leverage (execution distribution, success rates)

#### CMO Scorecard

- Channel performance (email, voice, SMS, calendar effectiveness)
- Lead quality distribution (source quality, conversion rates)
- Conversion by source (campaign attribution, ROI tracking)
- Cost efficiency (cost per lead, cost per conversion from GHL data)
- Campaign effectiveness (A/B test results, playbook performance)

#### Sales Head Scorecard

- Team performance (individual and team metrics)
- Rep skill distribution (AI vs human execution patterns)
- SLA adherence (response times, completion rates)
- Booking → close ratios (funnel efficiency)
- No-show rates (calendar reliability)

#### Team Lead Scorecard

- Rep activity health (daily task completion, response times)
- Script compliance (playbook adherence rates)
- Outcome quality (call ratings, conversion success)
- Escalations (frequency, reasons, resolution times)

### 5.4 OPERATOR EXPERIENCE REQUIREMENTS

- Daily task queue driven by NeuronX decisions (no manual task creation)
- Clear "WHAT YOU CAN DO NOW" with permission-based action filtering
- Blocked actions explained with reasons (policy violations, capability limits)
- Next-best-action surfaced with context and guidance
- Mandatory outcome logging for all actions (success/failure/reason)
- Zero ambiguity - system tells operator exactly what to do and why

### 5.5 EXPLAINABILITY & TRUST UI

UI must surface decision explanations (WI-052) including:

- Policy references (which rules applied, versions, thresholds)
- Authority reasons (org scope, capability grants, approval requirements)
- Billing constraints (plan limits, quota status, enforcement reasons)
- Drift warnings (configuration changes affecting decisions)
- Audit trails (who approved, when, correlation IDs)
- Confidence indicators (AI decision certainty, risk levels)

### 5.6 PERFORMANCE & RELIABILITY REQUIREMENTS

UI must support:

- Near-real-time updates (WebSocket/subscription-based)
- Clear stale-data indicators (last updated timestamps, freshness warnings)
- Graceful degradation if GHL is down (read-only fallback modes)
- Offline capability for critical operations (task queue caching)
- Audit-first UX (every action logged with full context)
- Performance monitoring (page load times, API response times)
- Error boundaries (user-friendly error messages, retry mechanisms)

---

## 6. UI EXECUTION HARD BLOCK

### 🚫 EXECUTION PROHIBITED

- No UI prompts may be executed by Cursor
- No UI framework decisions allowed
- No design tools or mockups allowed
- No component creation or styling allowed
- No user testing or feedback collection allowed
- No UI-related code changes allowed

### 🔓 UNLOCK CONDITIONS

EP-UI may only be unlocked after:

1. All backend EPs (EP-04 through EP-07) are 100% complete
2. Full enterprise testing (performance, security, compliance) passed
3. Customer discovery interviews completed
4. Written approval from product owner
5. UI architecture and technology stack decisions finalized

Until then, EP-UI remains REQUIREMENTS ONLY.

---

## 7. CHANGE CONTROL

### New WI Proposals

1. Must be documented in GitHub issue with complete requirements
2. Must reference existing EPs and demonstrate fit
3. Must include acceptance criteria and success metrics
4. Must be approved by architecture review
5. Must include implementation plan and risk assessment

### EP-UI Unlock Process

1. Backend completion evidence submitted
2. UI requirements review and approval
3. Technology stack decision documented
4. Design system and component library selected
5. Written unlock approval from governance lead

### Evidence Standards

- All WIs require docs/EVIDENCE/ folder
- Test results must show >90% coverage
- Performance benchmarks must be documented
- Security scans must pass with zero critical issues
- Integration tests must validate end-to-end flows

### Governance Violations

Any work outside this backlog is unauthorized and will be rejected. This includes:

- Feature creep not in approved WIs
- UI work before EP-UI unlock
- Technology choices not pre-approved
- Scope changes without documented approval

---

## 8. FINAL LOCK

**Document Status:** LOCKED  
**Date:** January 5, 2026  
**Authority:** This document is the sole authority for NeuronX development. Anything outside it is invalid and unauthorized. All team members must reference this document for work approval and prioritization.

**Next Steps:**

1. Complete EP-05 (GHL Maximum Leverage)
2. Execute EP-06 (Operations, Observability & Trust)
3. Complete EP-07 (Docs, Sales & Scale)
4. Unlock EP-UI for product UI development

This ensures NeuronX becomes a world-class, enterprise-ready sales operating system with unmatched governance, observability, and user experience.
