# GoHighLevel Integration Plan

**Last verified:** 2026-01-03
**Sources:** Official GHL Developer Docs (https://developers.gohighlevel.com)

## Vision

NeuronX will white-label GoHighLevel as its execution layer, providing enterprise sales teams with AI-driven orchestration while leveraging GHL's comprehensive CRM, marketing automation, and communication capabilities.

## Strategy

**White-label Execution Layer:** GHL handles user interface, data persistence, and execution mechanics. NeuronX provides the intelligence layer - AI scoring, workflow orchestration, and business rule management.

**Integration Principles:**

- **Clean Separation:** NeuronX business logic never leaks into GHL adapters
- **Configuration-Driven:** All behavior controlled by NeuronX rules, not GHL automations
- **Event-First:** All changes flow through NeuronX's event-driven architecture
- **Multi-Tenant Ready:** Integration scales across thousands of customers

## Phase 1: Capability Map (Current)

**Goal:** Create comprehensive, engineering-ready knowledge base of GHL capabilities that NeuronX can leverage.

### Phase 1 Checklist

**✅ Governance & Planning**

- [x] Create docs/INTEGRATION_PLAN.md (this file)
- [x] Create docs/ghl_capability_map/ directory structure
- [x] Define verification cadence and update process

**✅ Core Knowledge Base**

- [x] 00_INDEX.md - Table of contents and usage guide
- [x] 01_CONTEXT_MODEL.md - Agency/Location/Sub-account conceptual model
- [x] 02_AUTH_AND_TOKEN_LIFECYCLE.md - OAuth flow and token management
- [x] 03_SCOPES_CATALOG.md - OAuth scopes and risk assessment

**✅ Capability Catalog**

- [x] 04_FEATURE_MODULE_CATALOG.md - Major GHL modules and NeuronX leverage
- [x] 05_API_ENDPOINT_MATRIX.md - Normalized API endpoint matrix (most critical)
- [x] 06_WEBHOOKS_AND_EVENTS.md - Webhook types and event mapping

**✅ Engineering Artifacts**

- [x] 07_LIMITS_RETRIES_ERRORS.md - Rate limits, error handling, debugging
- [x] 08_NEURONX_BUILD_BLUEPRINT.md - Feature-to-GHL mapping and MVP slices

**✅ Integration & Testing**

- [x] docs/TRACEABILITY.md updated with capability map entries
- [x] docs/ENGINEERING_LOG.md logged capability map creation
- [x] docs/PRODUCT_LOG.md updated with integration knowledge base
- [x] memory/PROJECT_CONTEXT.md includes GHL knowledge layer section

**✅ Environment & Account Strategy**

- [x] ADR-0015 created: Separate agencies for dev/stage/prod environments
- [x] GHL pricing strategy documented: Dev (Starter), Stage/Prod (Unlimited)
- [x] Environment isolation and blast-radius strategy defined
- [x] Account management procedures and naming conventions established
- [x] DevContext MCP configured and active for development context
- [ ] Cipher MCP activation point identified (Phase 2 start)

**✅ SDK & Platform Strategy**

- [x] Official SDKs evaluated (Node/Python/PHP) vs custom TypeScript client
- [x] Decision: Custom TypeScript client for full control and NestJS integration
- [x] HighLevel MCP server evaluated for AI-assisted development
- [x] Decision: MCP for development tools, Direct API for production features
- [x] Voice AI and Conversation AI capabilities assessed
- [x] Decision: Text AI in MVP, Voice AI as future premium feature

**✅ FAANG-Grade Adapter Contracts (Phase 2)**

- [x] Canonical domain models created (`packages/domain/models/`)
- [x] Adapter contracts defined (`packages/adapters/contracts/`)
- [x] GHL adapter implementation complete (`packages/adapters/ghl/`)
- [x] Token vault for multi-tenant security (`packages/security/token-vault/`)
- [x] Webhook normalization layer (`packages/adapters/webhooks/`)
- [x] Contract and safety tests implemented
- [x] Cursor rules for architectural enforcement (`.cursor/rules/70_adapter_architecture.mdc`)
- [x] Architecture documentation created (`docs/ARCHITECTURE_ADAPTERS.md`)
- [x] DevContext MCP confirmed indexing adapter packages
- [x] Cipher MCP activation point identified (Phase 2 start)

**✅ Production Integration Pack (Phase 3A)**

- [x] Standardized ENV + config validation (`packages/config/`, `.env.example`, `docs/RUNBOOK_GHL_INTEGRATION.md`)
- [x] Production token vault with encryption/key rotation (`packages/security/token-vault/`)
- [x] OAuth lifecycle management (`packages/integration/ghl-auth/`)
- [x] HTTP client hardening with retry/rate limiting/circuit breaker (`packages/integration/http/`)
- [x] Webhook verification + replay protection (`packages/adapters/webhooks/`)
- [x] Observability framework (`packages/observability/`, `docs/OBSERVABILITY.md`)
- [x] Integration safety rules (`.cursor/rules/80_integration_safety.mdc`)

### Sandbox Retirement Criteria

**TEMPORARY:** `test-ghl-oauth/` folder exists for development validation only.

**Deletion Requirements:**

- [ ] Phase 3A e2e test passes (`apps/core-api/test/ghl-oauth-flow.e2e-spec.ts`, `apps/core-api/test/ghl-webhook.e2e-spec.ts`)
- [ ] OAuth callback works through core-api endpoint (`/integrations/ghl/auth/callback`)
- [ ] Token vault persistence verified (encrypted tokens in database)
- [ ] Webhook processing works end-to-end (`/integrations/ghl/webhooks`)
- [ ] All integration tests pass in CI/CD

**Pre-Deletion Verification Requirements:**

- [ ] GHL webhook signature algorithm verified (docs/ghl_capability_map/14_VERIFICATION_CHECKLIST.md)
- [ ] GHL API rate limits empirically tested and confirmed
- [ ] Token refresh behavior verified with real tokens
- [ ] All UNKNOWN items in verification checklist resolved

**Current Status:** Sandbox retirement criteria NOT met. The `test-ghl-oauth/` folder should remain until all criteria are satisfied and end-to-end integration is verified.

**Post-Deletion:** Remove `test-ghl-oauth/` folder and update this checklist.

## Phase 2: Integration Pack

**Goal:** Build reusable integration components that NeuronX can compose for features.

### Phase 2 Checklist

**🔄 Core Integration Components**

- [ ] Create packages/ghl-sdk/ - Type-safe GHL API client
- [ ] Create packages/webhook-ingest/ - Webhook validation and processing
- [ ] Create packages/oauth-manager/ - Token lifecycle management
- [ ] Create apps/ghl-sync-worker/ - Background sync processes

**🔄 Adapter Framework**

- [ ] Implement adapter contract interfaces
- [ ] Create test harness for adapter validation
- [ ] Build adapter registry and discovery
- [ ] Add adapter health monitoring

**🔄 Event Mapping & Processing**

- [ ] Implement GHL-to-NeuronX event transformation
- [ ] Add event deduplication and idempotency
- [ ] Create event processing pipelines
- [ ] Add event correlation and tracing

## Phase 3: MVP Feature Integration

**Goal:** Build first end-to-end NeuronX features using the integration pack.

### Phase 3 Checklist

**📋 MVP Slice 1: Contact Sync & Scoring**

- [ ] Implement contact ingestion from GHL webhooks
- [ ] Add contact scoring with configurable rules
- [ ] Create contact sync bidirectional updates
- [ ] Add contact scoring audit logging

**📋 MVP Slice 2: Opportunity Management**

- [ ] Implement opportunity creation from scored contacts
- [ ] Add opportunity stage tracking and updates
- [ ] Create opportunity assignment logic
- [ ] Add opportunity lifecycle event processing

**📋 MVP Slice 3: Communication Orchestration**

- [ ] Implement email campaign triggering
- [ ] Add SMS/WhatsApp communication flows
- [ ] Create communication sequence management
- [ ] Add communication delivery tracking

## Phase 4: Advanced Features

**Goal:** Build sophisticated NeuronX features leveraging full GHL capabilities.

### Phase 4 Checklist

**🔄 AI-Powered Workflows**

- [ ] Implement dynamic workflow creation
- [ ] Add AI-driven workflow optimization
- [ ] Create workflow performance analytics
- [ ] Add workflow A/B testing capabilities

**🔄 Multi-Channel Orchestration**

- [ ] Implement cross-platform communication
- [ ] Add communication preference management
- [ ] Create unified conversation threading
- [ ] Add communication analytics and insights

**🔄 Advanced Analytics & Reporting**

- [ ] Implement comprehensive performance metrics
- [ ] Add predictive analytics integration
- [ ] Create custom reporting and dashboards
- [ ] Add data export and compliance features

## No Drift Rule

**MANDATORY:** All GHL integration development MUST be guided by:

1. **docs/REQUIREMENTS.md** - Defines what NeuronX is and isn't
2. **docs/ghl_capability_map/** - Defines what GHL can and cannot do
3. **docs/DECISIONS/** - Records architectural decisions made
4. **docs/TRACEABILITY.md** - Links features to tests and evidence

**Prohibited:** Building features based on assumptions, undocumented GHL behaviors, or unverified API capabilities.

## Verification Cadence

**Weekly:** Review docs/ghl_capability_map/ against latest GHL docs
**Monthly:** Test critical integration paths against live GHL environment
**Quarterly:** Audit integration code against capability map
**Breaking Changes:** Immediate review and update when GHL announces changes

## Risk Mitigation

**🔴 High Risk:** GHL API changes break NeuronX features

- **Mitigation:** Comprehensive capability map, adapter isolation, automated testing

**🟡 Medium Risk:** Rate limiting affects performance

- **Mitigation:** Rate limit awareness, intelligent retry logic, usage monitoring

**🟢 Low Risk:** New GHL features become available

- **Mitigation:** Regular capability map updates, feature flag system for opt-in

## Success Metrics

**Capability Coverage:** 90%+ of NeuronX requirements mapped to GHL capabilities
**Integration Quality:** Zero undocumented API behaviors in production
**Development Velocity:** Feature development blocked <5% by integration unknowns
**Maintenance Cost:** <10% of development time spent on GHL integration issues
