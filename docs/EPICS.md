# Epics

**Purpose:** Product-scale capabilities that deliver customer value. Each epic maps to requirements and decomposes into user stories.

## EPIC-01: Canonical Sales Orchestration Engine

- **Related REQs:** REQ-001, REQ-002, REQ-009
- **Scope:** IN-SCOPE (Core $10M product)
- **Description:** AI-driven sales orchestration platform that provides intelligent workflow management, predictive lead scoring, and automated process optimization as the core intelligence layer, while delegating execution to external platforms.
- **Success Criteria:**
  - Lead scoring algorithms achieve >85% accuracy vs manual assessment
  - Predictive routing reduces assignment errors by >20%
  - Orchestration latency <5 seconds for critical paths
  - Complete audit trail enables state reconstruction

## EPIC-02: AI Scoring & Routing Intelligence

- **Related REQs:** REQ-005, REQ-006
- **Scope:** IN-SCOPE (Core $10M product)
- **Description:** Machine learning models for lead qualification, predictive analytics, and automated team assignment with Cipher safety monitoring and explainability.
- **Success Criteria:**
  - ML models execute within NeuronX boundaries only
  - Prediction results never cached externally
  - Cipher monitoring active on all AI decisions
  - Scoring accuracy improves 15% over baseline

## EPIC-03: Multi-Tenant SaaS Foundation

- **Related REQs:** REQ-013, REQ-014
- **Scope:** IN-SCOPE (Core $10M product)
- **Description:** Single database with tenant_id isolation supporting agency-level and location-specific operations for enterprise-scale multi-tenancy.
- **Success Criteria:**
  - All queries filtered by tenant_id at database level
  - Row-level security prevents cross-tenant data access
  - Company tokens grant agency-wide access
  - Location tokens restrict to specific sub-accounts

## EPIC-04: GHL Integration & Adapter Layer

- **Related REQs:** REQ-007, REQ-008, REQ-011, REQ-012
- **Scope:** IN-SCOPE (Core $10M product)
- **Description:** Stateless adapter pattern for GHL integration with OAuth, webhooks, and workflow execution while maintaining IP boundaries.
- **Success Criteria:**
  - No business logic in GHL workflows or automations
  - All decision logic, branching, and timers in NeuronX
  - Contract tests validate adapter boundaries
  - GHL serves as execution layer only

## EPIC-05: Security & Safety Infrastructure

- **Related REQs:** REQ-015, REQ-016
- **Scope:** IN-SCOPE (Core $10M product)
- **Description:** Webhook signature validation, secure token lifecycle, audit logging, and Cipher AI safety monitoring.
- **Success Criteria:**
  - HMAC-SHA256 signature verification on all webhooks
  - Access tokens expire within 1 hour maximum
  - Idempotent processing prevents duplicate events
  - Cipher monitors all AI decisions with mode enforcement

## EPIC-06: Testing & Quality Assurance

- **Related REQs:** REQ-017, REQ-018
- **Scope:** IN-SCOPE (Core $10M product)
- **Description:** 85%+ code coverage across unit, integration, and E2E tests with automated evidence collection and contract boundary enforcement.
- **Success Criteria:**
  - Unit tests cover business logic with >85% coverage
  - Integration tests validate component interactions
  - E2E tests cover critical user journeys
  - Contract tests prevent vendor type leakage

## EPIC-07: Voice & Real-Time Agent Layer

- **Related REQs:** NONE (Future roadmap)
- **Scope:** FUTURE ($10M+ roadmap)
- **Description:** AI-powered voice agents for inbound/outbound calling, real-time conversation intelligence, and automated appointment booking integrated with sales orchestration.
- **Success Criteria:**
  - Voice agents qualify leads through natural conversation
  - Real-time sentiment analysis during calls
  - Automated appointment booking via voice commands
  - Integration with existing sales routing logic

## EPIC-08: Configuration-as-IP Marketplace

- **Related REQs:** NONE (Future roadmap)
- **Scope:** FUTURE ($10M+ roadmap)
- **Description:** Versioned sales process templates, scoring models, and SLA definitions as sellable configuration artifacts with marketplace distribution.
- **Success Criteria:**
  - YAML/JSON-based sales OS definitions
  - Versioned scoring models with marketplace
  - Declarative SLA definitions
  - Template marketplace with revenue sharing

## EPIC-09: Control Plane & Entitlements

- **Related REQs:** NONE (Future roadmap)
- **Scope:** FUTURE ($10M+ roadmap)
- **Description:** Multi-tenant administration, user management, entitlements, and billing integration for enterprise SaaS operations.
- **Success Criteria:**
  - User role-based access control across tenants
  - Entitlement management for feature access
  - Billing integration with usage tracking
  - Administrative dashboards for tenant management
