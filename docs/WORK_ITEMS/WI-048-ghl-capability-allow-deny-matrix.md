# WI-048: GHL Capability Allow/Deny Matrix

## Objective

Implement a comprehensive, policy-driven system to control which GHL capabilities are allowed per tenant plan tier, with enterprise-grade enforcement, auditability, and safety guarantees. Prevent unauthorized access to GHL features while enabling legitimate use cases.

## Scope

### In Scope

- Create versioned GHL capability policy (YAML + schema validation)
- Define comprehensive capability matrix (CRM, conversations, workflows, identity, calendar, voice, webhooks)
- Implement enforcement modes (block, allow_with_audit, allow_with_limits)
- Add configurable limits per capability (requests/hour, concurrent, data size)
- Update GHL adapter with capability checks at execution boundaries
- Add enterprise audit logging for capability usage/denials
- Implement unknown capability fallback behavior
- Add comprehensive policy validation and business rules

### Out of Scope

- Modifying GHL billing or pricing logic
- Changing execution planning or token issuance logic
- Adding UI for capability management
- Modifying GHL webhook processing (beyond validation)
- Implementing capability usage metering (beyond basic limits)

## Implementation Details

### Policy Schema

```yaml
# GHL Capability Policy Configuration - WI-048
version: '1.0.0'
description: 'GHL capability matrix for NeuronX plan tiers'
lastUpdated: '2026-01-05'
updatedBy: 'NeuronX Platform Team'

# Plan-specific capability matrices
planCapabilityMatrices:
  - planTier: 'FREE'
    description: 'Basic capabilities for free tier'
    capabilities:
      - capability: 'crm_create_lead'
        enforcementMode: 'allow_with_audit'
        limits:
          maxRequestsPerHour: 10
          maxRequestsPerDay: 50
        description: 'Basic lead creation with limits'
        tags: ['crm', 'basic']
        enabled: true

      - capability: 'conversation_send_message'
        enforcementMode: 'block'
        description: 'Messaging blocked on free plan'
        tags: ['communication', 'blocked']
        enabled: true

  - planTier: 'PRO'
    description: 'Professional capabilities'
    capabilities:
      - capability: 'workflow_trigger'
        enforcementMode: 'allow_with_limits'
        limits:
          maxRequestsPerHour: 20
          maxConcurrent: 5
        description: 'Workflow automation with limits'
        tags: ['automation', 'core']
        enabled: true

# Environment-specific overrides (optional)
environmentOverrides:
  - environment: 'staging'
    mappings:
      - planTier: 'FREE'
        capabilities:
          - capability: 'conversation_send_message'
            enforcementMode: 'allow_with_audit'
            description: 'Messaging allowed in staging for testing'
            enabled: true

# Fallback for unknown capabilities (critical safety feature)
fallback:
  behavior: 'grace_with_alert' # block | grace_with_alert | default_tier
  defaultTier: 'FREE' # Only used if behavior is "default_tier"
  alertChannels:
    - 'security-alerts@neuronx.ai'
    - 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
  gracePeriodDays: 7

# Audit and monitoring settings
audit:
  auditCapabilityUsage: true
  auditCapabilityDenials: true
  auditCapabilityLimitsExceeded: true
  auditRetentionDays: 90
```

### GHL Capabilities Matrix

| Category          | Capability                 | FREE              | PRO               | ENTERPRISE        |
| ----------------- | -------------------------- | ----------------- | ----------------- | ----------------- |
| **CRM**           | crm_create_lead            | allow_with_audit  | allow_with_limits | allow_with_limits |
|                   | crm_update_lead            | allow_with_audit  | allow_with_limits | allow_with_limits |
|                   | crm_list_leads             | allow_with_limits | allow_with_limits | allow_with_limits |
|                   | crm_create_opportunity     | block             | allow_with_audit  | allow_with_limits |
|                   | crm_update_opportunity     | block             | allow_with_audit  | allow_with_limits |
|                   | crm_list_opportunities     | block             | allow_with_limits | allow_with_limits |
| **Conversations** | conversation_send_message  | block             | allow_with_limits | allow_with_limits |
|                   | conversation_list_messages | block             | allow_with_limits | allow_with_limits |
| **Workflows**     | workflow_trigger           | block             | allow_with_limits | allow_with_limits |
|                   | workflow_pause             | block             | allow_with_limits | allow_with_limits |
|                   | workflow_resume            | block             | allow_with_limits | allow_with_limits |
| **Calendar**      | calendar_create_event      | block             | allow_with_limits | allow_with_limits |
| **Voice**         | voice_call_initiate        | block             | allow_with_limits | allow_with_limits |
| **Identity**      | identity_list_users        | allow_with_limits | allow_with_limits | allow_with_limits |

### Enforcement Modes

- **block**: Hard block - capability completely unavailable
- **allow_with_audit**: Allow usage but log all access for audit
- **allow_with_limits**: Allow with configurable rate/data limits

### Capability Limits

```typescript
limits: {
  maxRequestsPerHour: 100,     // Rate limiting
  maxRequestsPerDay: 500,      // Daily quotas
  maxConcurrent: 5,            // Simultaneous operations
  maxDataSizeBytes: 1048576,   // Data size limits
  allowedTimeWindows: [{        // Time-based restrictions
    start: "09:00",
    end: "17:00",
    daysOfWeek: [1, 2, 3, 4, 5]  // Monday-Friday
  }]
}
```

### Files Modified

- `packages/adapters/contracts/ghl-capability-policy.types.ts` (NEW)
- `config/ghl-capability-policy.yaml` (NEW)
- `packages/adapters/contracts/ghl-capability-policy.loader.ts` (NEW)
- `packages/adapters/contracts/ghl-capability-policy.resolver.ts` (NEW)
- `packages/adapters/ghl/ghl.adapter.ts` (UPDATED - capability checks added)
- `packages/adapters/contracts/index.ts` (UPDATED - exports)
- `packages/adapters/contracts/__tests__/ghl-capability-policy.loader.spec.ts` (NEW)
- `packages/adapters/contracts/__tests__/ghl-capability-policy.resolver.spec.ts` (NEW)

### Enforcement Points

Capability checks are enforced at **adapter execution boundaries**:

1. **GHL Adapter Methods**: Each adapter method checks capabilities before API calls
2. **Tenant Plan Resolution**: Dynamic lookup of tenant's current plan tier
3. **Audit Logging**: All capability usage/denials logged with full context
4. **Fallback Handling**: Unknown capabilities handled according to policy

### Audit Events

Capability enforcement generates detailed audit events:

```json
{
  "eventType": "ghl_capability_denied",
  "tenantId": "tenant_123",
  "capability": "workflow_trigger",
  "planTier": "FREE",
  "reason": "Plan configuration: Workflow automation not available on free plan",
  "enforcementMode": "block",
  "timestamp": "2026-01-05T10:30:00Z",
  "userId": "user_456",
  "operation": "adapter_execution"
}
```

## Acceptance Criteria

### Functional Requirements

- [x] Unknown GHL capabilities default to BLOCK enforcement
- [x] Each plan tier has appropriate capability access levels
- [x] Capability checks occur before GHL API calls
- [x] Environment overrides work correctly
- [x] Audit logging captures all capability decisions
- [x] Fallback behavior handles edge cases safely
- [x] Rate limits and quotas are enforceable
- [x] Startup fails with invalid capability policy

### Quality Requirements

- [x] All tests pass including regression tests
- [x] No linting errors or type violations
- [x] Policy schema strictly validated
- [x] Error messages clear and actionable
- [x] Code comments mark capability enforcement points

### Enterprise Requirements

- [x] Configuration human-readable and editable
- [x] Changes auditable and version-controlled
- [x] Schema prevents invalid configurations
- [x] Fail-fast behavior prevents runtime surprises
- [x] Business rules validated beyond schema

## Testing Strategy

### Unit Tests

- Policy loader validation (valid/invalid configs, business rules)
- Policy resolver capability checking and fallback logic
- GHL adapter capability enforcement integration
- Audit event generation and formatting
- Environment override precedence

### Integration Tests

- Full capability check workflow (plan lookup → policy check → enforcement)
- Audit logging end-to-end verification
- Fallback behavior testing with alerts
- Multi-tenant capability isolation

### Regression Tests

- Verify no hardcoded capability checks remain
- Confirm all GHL adapter methods include capability checks
- Validate audit events are properly structured
- Ensure capability denials prevent API calls

## Risk Mitigation

- **Silent Capability Leaks**: Unknown capabilities default to BLOCK
- **Configuration Drift**: Strict schema validation prevents invalid configs
- **Audit Gaps**: Mandatory audit logging for all capability decisions
- **Rate Limit Bypass**: Limits checked at adapter boundaries
- **Environment Inconsistencies**: Environment overrides for testing flexibility

## Dependencies

- `js-yaml` for YAML parsing
- `zod` for runtime schema validation
- Existing billing service for plan tier resolution
- GHL adapter for capability enforcement points

## Rollback Plan

1. Remove capability check calls from GHL adapter methods
2. Remove capability resolver injection
3. Revert to allow-all behavior with logging only
4. Remove policy-related files and dependencies

## Success Metrics

- Zero unauthorized GHL capability usage in production
- 100% audit coverage for GHL capability decisions
- Successful startup with valid capability policy
- Failed startup with invalid policy (fail-fast)
- Alert system working for blocked capabilities
