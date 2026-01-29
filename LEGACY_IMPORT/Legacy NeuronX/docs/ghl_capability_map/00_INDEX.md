# GHL Capability Map - Index

**Last verified:** 2026-01-03
**Version:** 1.0
**Sources:** Official GHL Developer Docs (https://developers.gohighlevel.com)

## Table of Contents

| File                                                             | Purpose                | Key Sections                                              | Use Case                                   |
| ---------------------------------------------------------------- | ---------------------- | --------------------------------------------------------- | ------------------------------------------ |
| [01_CONTEXT_MODEL.md](01_CONTEXT_MODEL.md)                       | GHL conceptual model   | Agency/Location hierarchy, token scopes, data isolation   | Understand GHL's multi-tenant architecture |
| [02_AUTH_AND_TOKEN_LIFECYCLE.md](02_AUTH_AND_TOKEN_LIFECYCLE.md) | OAuth flow and tokens  | Token types, refresh logic, failure recovery              | Implement secure authentication            |
| [03_SCOPES_CATALOG.md](03_SCOPES_CATALOG.md)                     | OAuth scopes catalog   | Scope permissions, risk levels, feature mappings          | Determine required OAuth permissions       |
| [04_FEATURE_MODULE_CATALOG.md](04_FEATURE_MODULE_CATALOG.md)     | GHL modules overview   | Contacts, Opportunities, Workflows, Communications        | Choose GHL modules for NeuronX features    |
| [05_API_ENDPOINT_MATRIX.md](05_API_ENDPOINT_MATRIX.md)           | API endpoint reference | Methods, scopes, rate limits, examples                    | Implement API integrations                 |
| [06_WEBHOOKS_AND_EVENTS.md](06_WEBHOOKS_AND_EVENTS.md)           | Webhook capabilities   | Event types, payloads, retry logic                        | Build event-driven integrations            |
| [07_LIMITS_RETRIES_ERRORS.md](07_LIMITS_RETRIES_ERRORS.md)       | Constraints and errors | Rate limits, error codes, debugging                       | Handle edge cases and failures             |
| [08_NEURONX_BUILD_BLUEPRINT.md](08_NEURONX_BUILD_BLUEPRINT.md)   | Feature mapping        | NeuronX features → GHL capabilities → implementation plan | Plan feature development                   |

## How to Use While Building Features

### Step 1: Feature Planning

- **Read:** docs/REQUIREMENTS.md to confirm feature scope
- **Check:** 08_NEURONX_BUILD_BLUEPRINT.md for GHL capability mapping
- **Verify:** Required scopes in 03_SCOPES_CATALOG.md

### Step 2: Technical Design

- **Review:** 04_FEATURE_MODULE_CATALOG.md for relevant GHL modules
- **Select:** API endpoints from 05_API_ENDPOINT_MATRIX.md
- **Plan:** Webhook integration using 06_WEBHOOKS_AND_EVENTS.md

### Step 3: Implementation

- **Authenticate:** Follow 02_AUTH_AND_TOKEN_LIFECYCLE.md patterns
- **Handle Limits:** Apply strategies from 07_LIMITS_RETRIES_ERRORS.md
- **Context Aware:** Use 01_CONTEXT_MODEL.md for multi-tenant considerations

### Step 4: Testing & Deployment

- **Test Contracts:** Validate against documented API behaviors
- **Handle Errors:** Use documented error patterns and recovery
- **Monitor:** Implement observability for rate limits and failures

### Step 5: Maintenance

- **Monitor Changes:** Watch for GHL API updates
- **Update Map:** Add newly discovered behaviors to relevant files
- **Document Workarounds:** Note any undocumented behaviors encountered

## Quick Reference

### Most Critical for NeuronX MVP

**Authentication & Setup:**

- OAuth flow: 02_AUTH_AND_TOKEN_LIFECYCLE.md
- Required scopes: contacts.readonly, locations.readonly, contacts.write, opportunities.write

**Core Data Operations:**

- Contact CRUD: 05_API_ENDPOINT_MATRIX.md (Contacts section)
- Opportunity management: 05_API_ENDPOINT_MATRIX.md (Opportunities section)

**Event-Driven Integration:**

- Contact webhooks: 06_WEBHOOKS_AND_EVENTS.md (contact.created, contact.updated)
- Opportunity events: 06_WEBHOOKS_AND_EVENTS.md (opportunity.created, opportunity.stage_changed)

**Error Handling:**

- Rate limits: 07_LIMITS_RETRIES_ERRORS.md
- Common errors: 401 (reauth), 429 (rate limit), 403 (insufficient scope)

### Common Integration Patterns

**Contact Synchronization:**

1. Use webhooks for real-time updates (contact.created, contact.updated)
2. Bulk sync via API for initial load (/contacts)
3. Handle rate limits with exponential backoff

**Opportunity Management:**

1. Create opportunities via API (/opportunities)
2. Track stage changes via webhooks
3. Update values and assignments as needed

**Workflow Integration:**

1. Trigger GHL workflows via API (if available)
2. Monitor workflow completion via webhooks
3. Handle workflow failures gracefully

## Risk Assessment Matrix

| Risk Level | Description                             | Mitigation                     |
| ---------- | --------------------------------------- | ------------------------------ |
| 🟢 Low     | Well-documented, stable APIs            | Standard implementation        |
| 🟡 Medium  | Rate-limited or complex APIs            | Add retry logic, monitor usage |
| 🔴 High    | Beta features or undocumented behaviors | Avoid or add extensive testing |
| ⚪ Unknown | Not yet verified in this map            | Test thoroughly before using   |

## Update Process

### Weekly Review

- [ ] Check official GHL docs for changes
- [ ] Test critical integration paths
- [ ] Update verification dates

### Feature Development

- [ ] Consult this map before implementing new GHL integrations
- [ ] Document any discrepancies found during development
- [ ] Add new capabilities discovered to appropriate files

### Breaking Changes

- [ ] Immediately update affected sections
- [ ] Assess impact on existing NeuronX features
- [ ] Create migration plan and update team

This index provides the entry point to NeuronX's comprehensive GHL integration knowledge base. Use it to navigate to specific topics and ensure all GHL integrations are built on verified, well-understood capabilities.
