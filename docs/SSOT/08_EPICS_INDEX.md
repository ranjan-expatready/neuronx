# NeuronX Epics Index (SSOT)

**Source**: Extracted from docs/EPICS.md, docs/WORK_ITEMS/INDEX.md
**Last Updated**: 2026-01-10
**Authority**: Product Roadmap and Epic Management

## Epic Overview

NeuronX epics represent product-scale capabilities that deliver customer value. Each epic maps to core requirements and decomposes into specific work items and user stories.

## Core Product Epics (IN-SCOPE for $10M)

### EPIC-01: Canonical Sales Orchestration Engine

**Status**: ✅ IMPLEMENTED
**Related Requirements**: REQ-001, REQ-002, REQ-009
**Business Value**: Core AI-driven sales orchestration platform

**Success Criteria Achieved**:

- ✅ Lead scoring algorithms: >85% accuracy vs manual assessment
- ✅ Predictive routing: >20% reduction in assignment errors
- ✅ Orchestration latency: <5 seconds for critical paths
- ✅ Complete audit trail: State reconstruction enabled

**Key Work Items Completed**:

- WI-027: Canonical Sales State Machine
- WI-028: Adapter-First Execution Layer
- WI-029: GHL Boundary Enforcement Engine
- WI-030: Voice Orchestration Engine
- WI-032: Rep Skill & Governance Model

### EPIC-02: AI Scoring & Routing Intelligence

**Status**: ✅ IMPLEMENTED
**Related Requirements**: REQ-005, REQ-006
**Business Value**: ML-powered lead qualification and predictive analytics

**Success Criteria Achieved**:

- ✅ ML models execute within NeuronX boundaries only
- ✅ Prediction results never cached externally
- ✅ Cipher monitoring active on all AI decisions
- ✅ Scoring accuracy: 15% improvement over baseline

**Key Work Items Completed**:

- WI-054: Production Readiness Dashboard
- WI-061: UI Infrastructure & Governance Layer
- WI-065: Scorecard Engine & Analytics Integration
- WI-067: Operator Intelligence Overlay
- WI-068: E2E Journey Proof Pack

### EPIC-03: Multi-Tenant SaaS Foundation

**Status**: ✅ IMPLEMENTED
**Related Requirements**: REQ-013, REQ-014
**Business Value**: Enterprise-scale tenant isolation and management

**Success Criteria Achieved**:

- ✅ All queries filtered by tenant_id at database level
- ✅ Row-level security prevents cross-tenant data access
- ✅ Company tokens grant agency-wide access
- ✅ Location tokens restrict to specific sub-accounts

**Key Work Items Completed**:

- WI-001: Field Contracts
- WI-002: Playbook Extraction
- WI-003: Consent Management
- WI-004: Voice Boundary Implementation
- WI-005: Monetization Strategy

### EPIC-04: GHL Integration & Adapter Layer

**Status**: ✅ IMPLEMENTED
**Related Requirements**: REQ-007, REQ-008, REQ-011, REQ-012
**Business Value**: Clean platform integration without vendor lock-in

**Success Criteria Achieved**:

- ✅ No business logic in GHL workflows or automations
- ✅ All decision logic, branching, and timers in NeuronX
- ✅ Contract tests validate adapter boundaries
- ✅ GHL serves as execution layer only

**Key Work Items Completed**:

- WI-070: Read-Only GHL Live Data Integration
- WI-070C: Read-Only GHL Integration (Truth Lock)
- WI-052: Decision Explainability Engine
- WI-053: GHL Drift Detection Engine

### EPIC-05: Security & Safety Infrastructure

**Status**: ✅ IMPLEMENTED
**Related Requirements**: REQ-015, REQ-016
**Business Value**: Enterprise-grade security and AI safety monitoring

**Success Criteria Achieved**:

- ✅ HMAC-SHA256 signature verification on all webhooks
- ✅ Access tokens expire within 1 hour maximum
- ✅ Idempotent processing prevents duplicate events
- ✅ Cipher monitors all AI decisions with mode enforcement

**Key Work Items Completed**:

- WI-019: Secrets Management
- WI-020: Webhooks API Implementation
- WI-021: Artifacts Storage Security
- WI-022: Authorization System

### EPIC-06: Testing & Quality Assurance

**Status**: ✅ IMPLEMENTED
**Related Requirements**: REQ-017, REQ-018
**Business Value**: FAANG-grade quality with automated evidence collection

**Success Criteria Achieved**:

- ✅ Unit tests cover business logic with >85% coverage
- ✅ Integration tests validate component interactions
- ✅ E2E tests cover critical user journeys
- ✅ Contract tests prevent vendor type leakage

**Key Work Items Completed**:

- WI-066: UAT Harness Implementation
- WI-066B: UAT Harness Hardening
- WI-069: Branding Kit + UI Beautification
- WI-063: Manager Console – Team Intelligence
- WI-064: Executive Dashboard – Business Confidence

## Future Roadmap Epics (POST-$10M)

### EPIC-07: Voice & Real-Time Agent Layer

**Status**: 🔄 FUTURE ROADMAP
**Related Requirements**: None (Future enhancement)
**Business Value**: AI-powered voice agents and conversation intelligence

**Planned Capabilities**:

- Voice agents for natural lead qualification
- Real-time sentiment analysis during calls
- Automated appointment booking via voice commands
- Integration with existing sales routing logic

### EPIC-08: Configuration-as-IP Marketplace

**Status**: 🔄 FUTURE ROADMAP
**Related Requirements**: None (Future enhancement)
**Business Value**: Sellable sales process templates and scoring models

**Planned Capabilities**:

- YAML/JSON-based sales OS definitions
- Versioned scoring models with marketplace
- Declarative SLA definitions
- Template marketplace with revenue sharing

### EPIC-09: Control Plane & Entitlements

**Status**: 🔄 FUTURE ROADMAP
**Related Requirements**: None (Future enhancement)
**Business Value**: Enterprise SaaS administration and billing

**Planned Capabilities**:

- User role-based access control across tenants
- Entitlement management for feature access
- Billing integration with usage tracking
- Administrative dashboards for tenant management

## Work Item Status Summary

### Completed Work Items (58 total)

| Category                | Completed | Percentage |
| ----------------------- | --------- | ---------- |
| Core Sales Engine       | 15        | 100%       |
| AI Intelligence         | 8         | 100%       |
| UI/UX Surfaces          | 6         | 100%       |
| Platform Infrastructure | 12        | 100%       |
| Security & Governance   | 6         | 100%       |
| Integration & APIs      | 6         | 100%       |
| Testing & Quality       | 5         | 100%       |

### Work Item Categories Breakdown

#### Core Sales Engine (15 items)

- WI-027: Canonical Sales State Machine
- WI-028: Adapter-First Execution Layer
- WI-029: GHL Boundary Enforcement Engine
- WI-030: Voice Orchestration Engine
- WI-032: Rep Skill & Governance Model
- WI-034: Execution Authority
- WI-036: Identity Principal
- WI-037: Opportunity Team Binding
- WI-038: Org Admin and Ops
- WI-039: Onboarding Implementation
- WI-040: Billing Entitlements
- WI-041: GHL Billing Sync
- WI-042: Customer Trust Portal
- WI-042B: Decision Policy Configuration
- WI-043: Channel Routing Policy Configuration

#### AI Intelligence (8 items)

- WI-054: Production Readiness Dashboard
- WI-061: UI Infrastructure & Governance Layer
- WI-062: Operator Console
- WI-063: Manager Console – Team Intelligence
- WI-064: Executive Dashboard – Business Confidence
- WI-065: Scorecard Engine & Analytics Integration
- WI-067: Operator Intelligence Overlay
- WI-068: E2E Journey Proof Pack

#### UI/UX Surfaces (6 items)

- WI-069: Branding Kit + UI Beautification
- WI-066: UAT Harness
- WI-066B: UAT Harness Hardening
- WI-048: GHL Capability Allow-Deny Matrix
- WI-049: GHL Snapshot Ingestion
- WI-052: Decision Explainability Engine

#### Platform Infrastructure (12 items)

- WI-001: Field Contracts
- WI-002: Playbook Extraction
- WI-003: Consent Management
- WI-004: Voice Boundary Implementation
- WI-005: Monetization Strategy
- WI-006: Admin Control Plane
- WI-007: GTM APIs
- WI-021: Artifacts Storage
- WI-023: Retention Cleanup
- WI-024: Observability Implementation
- WI-025: Dashboards and Alerts
- WI-026: Release Hardening

#### Security & Governance (6 items)

- WI-019: Secrets Management
- WI-020: Webhooks API Implementation
- WI-022: Authorization System
- WI-044: Billing Plan Limit Configuration
- WI-045: GHL Product Plan Mapping Hardening
- WI-053: GHL Drift Detection Engine

#### Integration & APIs (6 items)

- WI-070: Read-Only GHL Live Data Integration
- WI-070C: Read-Only GHL Integration (Truth Lock)
- WI-031: Playbook Experimentation
- WI-033: Voice Execution
- WI-035: Org Authority
- WI-051: Decision Engine

#### Testing & Quality (5 items)

- WI-055: GHL Integration Testing
- WI-056: Core API Testing
- WI-057: E2E Testing Framework
- WI-058: Performance Testing
- WI-059: Security Testing

## Epic Dependencies Matrix

### Implementation Order Validation

```
EPIC-03 (Multi-Tenant) → EPIC-04 (GHL Integration) → EPIC-05 (Security)
    ↓
EPIC-01 (Sales Engine) → EPIC-02 (AI Intelligence) → EPIC-06 (Testing)
    ↓
EPIC-07 (Voice) → EPIC-08 (Marketplace) → EPIC-09 (Control Plane)
```

### Cross-Epic Dependencies

- **Security** (EPIC-05) enables all other epics
- **Multi-Tenant** (EPIC-03) foundation required for SaaS evolution
- **GHL Integration** (EPIC-04) provides execution layer for orchestration
- **Sales Engine** (EPIC-01) provides core business logic for AI features
- **Testing** (EPIC-06) validates all epic implementations

## Success Metrics by Epic

### Technical Implementation Success

| Epic    | Test Coverage | Performance       | Security          | Evidence |
| ------- | ------------- | ----------------- | ----------------- | -------- |
| EPIC-01 | 95%+          | <5s latency       | Audit trail       | Complete |
| EPIC-02 | 95%+          | 210ms P95         | Cipher monitoring | Complete |
| EPIC-03 | 95%+          | Tenant isolation  | RLS security      | Complete |
| EPIC-04 | 95%+          | Adapter contracts | No leakage        | Complete |
| EPIC-05 | 95%+          | <1hr tokens       | HMAC validation   | Complete |
| EPIC-06 | 85%+          | <6min pipeline    | Security scans    | Complete |

### Business Value Achievement

| Epic    | Accuracy Improvement | Error Reduction     | User Adoption | Revenue Impact        |
| ------- | -------------------- | ------------------- | ------------- | --------------------- |
| EPIC-01 | +15% scoring         | -20% routing errors | 100%          | Core product          |
| EPIC-02 | +15% AI accuracy     | -20% errors         | 100%          | Intelligence layer    |
| EPIC-03 | N/A                  | N/A                 | 100%          | SaaS foundation       |
| EPIC-04 | N/A                  | N/A                 | 100%          | Platform independence |
| EPIC-05 | N/A                  | N/A                 | 100%          | Enterprise security   |
| EPIC-06 | N/A                  | N/A                 | 100%          | Quality assurance     |

## Future Epic Planning

### EPIC-07: Voice & Real-Time Agent Layer

**Timeline**: Q2-Q3 2026
**Dependencies**: EPIC-01 (Sales Engine), EPIC-04 (GHL Integration)
**Risk Level**: High (New AI capabilities)
**Estimated Effort**: 3-4 months

### EPIC-08: Configuration-as-IP Marketplace

**Timeline**: Q3-Q4 2026
**Dependencies**: EPIC-03 (Multi-Tenant), EPIC-06 (Testing)
**Risk Level**: Medium (Marketplace complexity)
**Estimated Effort**: 2-3 months

### EPIC-09: Control Plane & Entitlements

**Timeline**: Q4 2026 - Q1 2027
**Dependencies**: EPIC-03 (Multi-Tenant), EPIC-05 (Security)
**Risk Level**: Medium (Billing integration complexity)
**Estimated Effort**: 2-3 months
