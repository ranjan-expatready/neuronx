# WI-007: Sales/GTM Public API Contracts

**Work Item ID:** WI-007
**Status:** In Progress
**Priority:** High
**Estimated Effort:** 2 days
**Created:** 2026-01-03
**Last Updated:** 2026-01-03

## Executive Summary

Define the canonical public API surface for the NeuronX Sales OS through field-level contracts. This work item establishes the governed, declarative API contracts for lead management, qualification, routing, appointments, payments, and status queries while maintaining strict adherence to Sales OS boundaries, consent requirements, and usage metering.

## Objective

Create agent-executable API contracts that define the Sales/GTM public API surface without implementing runtime code. These contracts must establish:

- Complete field-level specifications for 7 API categories
- Explicit consent gating for applicable actions
- Usage dimension emission for billable operations
- Tenant isolation and idempotency guarantees
- Hard boundaries preventing bypass of Sales OS limits

## Scope

### In Scope

- **API Contract Definition:** Complete field-level contracts for public APIs
- **7 API Categories:**
  1. Lead ingestion (manual + bulk reference)
  2. Lead qualification & scoring trigger
  3. Routing trigger
  4. Appointment creation/update (no scheduling logic)
  5. Payment initiation (NOT verification)
  6. Read-only Sales OS status queries
  7. Webhook subscription registration (outbound only)
- **Security & Compliance:** Authentication, authorization, consent validation
- **Rate Limiting & Idempotency:** Contract-level specifications
- **Usage Metering:** Declarative usage dimension mappings
- **Documentation:** Complete API reference with examples

### Out of Scope

- **Runtime Implementation:** No controllers, services, or handlers
- **Voice Execution APIs:** Handled by voice platform boundaries
- **Admin Control APIs:** Defined in WI-006 Admin Control Plane
- **Case Management APIs:** Beyond Sales OS boundary
- **Billing/Invoicing APIs:** Usage is observational only
- **Analytics/Reporting APIs:** Future work item scope
- **UI-Specific Endpoints:** Backend API contracts only

### Explicit Non-Goals

- No database schema changes
- No business logic implementation
- No authentication/authorization code
- No rate limiting implementation
- No webhook delivery mechanisms
- No API gateway configuration
- No client SDK generation
- No API documentation generation

## Business Value

### Customer Impact

- **Programmatic Access:** Enable CRM and marketing automation integrations
- **Lead Management:** Streamlined lead ingestion and qualification workflows
- **Operational Efficiency:** Automated routing and appointment management
- **Compliance Assurance:** Built-in consent and privacy protections

### Technical Value

- **Contract-First Development:** API contracts drive implementation
- **Governance Enforcement:** Prevent API drift and boundary violations
- **Scalability Foundation:** Usage-metered, rate-limited API design
- **Security by Design:** Authentication and authorization contracts

### Risk Mitigation

- **Boundary Protection:** Hard API-level enforcement of Sales OS limits
- **Consent Compliance:** Explicit consent validation prevents violations
- **Usage Control:** Metered APIs prevent runaway consumption
- **Audit Trail:** Complete request tracing and attribution

## Acceptance Criteria

### Functional Requirements

- [ ] **Complete API Coverage:** All 7 API categories fully specified with field-level contracts
- [ ] **Consent Integration:** All applicable APIs explicitly gate on consent scopes
- [ ] **Usage Metering:** Billable APIs emit appropriate usage dimensions
- [ ] **Tenant Isolation:** All APIs include tenantId scoping and validation
- [ ] **Idempotency:** All mutating APIs support idempotent operations
- [ ] **Rate Limiting:** All APIs reference appropriate rate limit classes
- [ ] **Error Handling:** Comprehensive error response specifications
- [ ] **Schema Validation:** JSON schemas defined for all request/response bodies

### Technical Requirements

- [ ] **Boundary Compliance:** No APIs bypass VERIFIED_PAID → CaseOpened boundary
- [ ] **Voice Platform Respect:** No execution APIs for voice platforms
- [ ] **Admin Separation:** No admin control APIs mixed with public APIs
- [ ] **Contract Consistency:** APIs respect FIELD_CONTRACTS.md entity definitions
- [ ] **Security Foundations:** Authentication and authorization contracts complete
- [ ] **Performance Contracts:** Response time and throughput expectations defined

### Documentation Requirements

- [ ] **API Reference:** Complete endpoint documentation with examples
- [ ] **Field Mappings:** All fields mapped to canonical entity contracts
- [ ] **Error Catalog:** Comprehensive error code and message specifications
- [ ] **Version Strategy:** API evolution and versioning strategy defined
- [ ] **Deprecation Policy:** Breaking change and deprecation procedures

### Quality Assurance

- [ ] **Contract Validation:** All contracts validated against authoritative sources
- [ ] **Cross-Reference Checks:** APIs reference correct consent scopes and usage dimensions
- [ ] **Boundary Audits:** All APIs verified to respect Sales OS boundaries
- [ ] **Completeness Checks:** No missing headers, schemas, or validation rules

## Dependencies

### Prerequisite Work Items

- **WI-001:** Field Contracts (entity definitions)
- **WI-002:** Playbook Extraction (scope validation)
- **WI-003:** Consent Contracts (consent gating)
- **WI-005:** Usage Contracts (metering definitions)
- **WI-006:** Admin Control Plane (admin API separation)

### External Dependencies

- **Tenant Model:** Multi-tenant architecture established
- **Authentication System:** Token-based auth design complete
- **Rate Limiting Framework:** Rate limit contract definitions
- **Usage Metering:** Usage event contracts defined

## Deliverables

### Primary Artifacts

1. **`docs/CANONICAL/GTM_API_CONTRACTS.md`** - Complete API contract specifications
2. **`docs/WORK_ITEMS/WI-007-gtm-apis.md`** - This work item specification
3. **Updated `docs/TRACEABILITY.md`** - WI-007 mappings to requirements
4. **Updated `docs/WORK_ITEMS/INDEX.md`** - WI-007 registration
5. **`docs/EVIDENCE/gtm/2026-01-03/README.md`** - Validation evidence

### Validation Evidence

- Contract completeness verification
- Cross-reference validation results
- Boundary compliance audit
- Traceability validation output
- No-runtime-change confirmation

## Implementation Plan

### Phase 1: Contract Foundation (Day 1)

- Define global API requirements (headers, envelopes, errors)
- Establish API security and compliance foundations
- Create API evolution and versioning strategy

### Phase 2: Endpoint Contracts (Day 1-2)

- Lead ingestion API contracts
- Qualification and scoring trigger APIs
- Routing trigger API contracts
- Appointment management API contracts
- Payment initiation API contracts
- Status query API contracts
- Webhook subscription API contracts

### Phase 3: Integration & Validation (Day 2)

- Cross-reference consent and usage contracts
- Validate boundary compliance
- Complete documentation and examples
- Generate validation evidence

## Risk Assessment

### Technical Risks

- **Contract Drift:** API contracts could drift from entity contracts
- **Boundary Violations:** APIs could implicitly bypass Sales OS boundaries
- **Consent Gaps:** Missing consent validation in applicable APIs
- **Usage Omissions:** Billable APIs not emitting usage events

### Mitigation Strategies

- **Automated Validation:** Scripts to verify contract consistency
- **Boundary Audits:** Explicit boundary compliance checklists
- **Cross-Team Reviews:** Architecture and product team validation
- **Incremental Delivery:** Phase-gated delivery with validation gates

### Business Risks

- **Scope Creep:** Addition of out-of-scope APIs during development
- **Delayed Delivery:** Over-engineering of contract details
- **Integration Gaps:** APIs not integrable with existing contracts

### Mitigation Strategies

- **Strict Scope Control:** Regular scope validation against requirements
- **Time-Boxing:** Fixed delivery timeline with quality gates
- **Contract Reviews:** Regular validation against prerequisite work items

## Success Metrics

### Completion Metrics

- **Contract Coverage:** 100% of required APIs specified
- **Field Completeness:** All request/response fields defined
- **Validation Coverage:** All contracts include validation rules
- **Documentation Quality:** API reference complete with examples

### Quality Metrics

- **Boundary Compliance:** 100% APIs respect Sales OS boundaries
- **Consent Integration:** 100% applicable APIs include consent gating
- **Usage Metering:** 100% billable APIs emit usage dimensions
- **Security Foundations:** Complete authentication and authorization specs

### Validation Metrics

- **Traceability:** 100% APIs mapped to requirements
- **Cross-References:** All contracts reference prerequisite work items
- **Evidence Completeness:** Full validation evidence documented
- **Review Coverage:** Architecture and product team sign-off

## Follow-Up Work Items

### Immediate Next Steps

- **WI-008:** API Implementation (controllers, services, handlers)
- **WI-009:** API Gateway & Rate Limiting Implementation
- **WI-010:** Authentication & Authorization Implementation
- **WI-011:** Webhook Delivery System Implementation

### Future Dependencies

- **WI-012:** API Documentation Generation
- **WI-013:** Client SDK Development
- **WI-014:** API Monitoring & Analytics
- **WI-015:** API Version Management

## CRITICAL IMPLEMENTATION NOTES

### NO RUNTIME CODE

**This work item produces CONTRACTS ONLY.** No implementation artifacts are created, modified, or validated. All deliverables are documentation and governance artifacts.

### CONTRACT AUTHORITY

API contracts supersede all other API specifications. Implementation must validate against these contracts. No deviations allowed without ADR approval.

### BOUNDARY ENFORCEMENT

All APIs must explicitly respect the Sales OS boundary (lead ingestion → VERIFIED_PAID → CaseOpened). No APIs may operate beyond this boundary.

### CONSENT FIRST

Any API that could impact user privacy or require user permissions must explicitly validate appropriate consent scopes before operation.

### USAGE AWARE

All billable operations must emit appropriate usage events. Usage is observational only - never controls business logic.

---

**Work Item Status:** In Progress
**Next Action:** Complete API contract definitions and validation
**Estimated Completion:** 2026-01-05
