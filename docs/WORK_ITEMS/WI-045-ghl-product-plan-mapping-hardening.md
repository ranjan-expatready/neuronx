# WI-045: GHL Product → Plan Mapping Hardening

## Objective

Replace environment-driven and implicit product mapping with a first-class, enterprise-grade policy system that ensures GHL products are explicitly mapped to NeuronX plan tiers with full auditability and safety guarantees.

## Scope

### In Scope

- Create versioned plan mapping policy (YAML + schema validation)
- Implement PlanMappingPolicyResolver with SKU/price/variant matching
- Add configurable fallback behaviors (block, grace_with_alert, default_tier)
- Update GHL billing sync to use policy resolver only
- Remove all env-based product mapping logic
- Add enterprise audit logging for fallback usage
- Implement alert system for unmapped products
- Add comprehensive policy validation and business rules

### Out of Scope

- Modifying GHL billing webhook processing logic
- Changing billing enforcement behavior (already policy-driven)
- Adding new GHL API integrations
- Modifying subscription lifecycle management

## Implementation Details

### Policy Schema

```yaml
# Plan Mapping Policy Configuration - WI-045
version: '1.0.0'
description: 'GHL to NeuronX plan mapping policy'
lastUpdated: '2026-01-05'
updatedBy: 'NeuronX Platform Team'

# Product mappings with optional SKU/price matching
productMappings:
  - ghlProductId: 'prod_neuronx_free_monthly'
    neuronxPlanTier: 'FREE'
    description: 'NeuronX Free Plan - Monthly'
    sku: 'free_monthly'
    tags: ['starter', 'monthly']
    enabled: true

  - ghlProductId: 'prod_neuronx_pro_monthly'
    neuronxPlanTier: 'PRO'
    description: 'NeuronX Pro Plan - Monthly'
    sku: 'pro_monthly'
    priceId: 'price_pro_monthly_2026'
    tags: ['professional', 'monthly']
    enabled: true

# Environment-specific overrides
environmentOverrides:
  - environment: 'staging'
    mappings:
      - ghlProductId: 'prod_staging_test'
        neuronxPlanTier: 'FREE'
        description: 'Staging test product'
        enabled: true

# Fallback behavior (critical for safety)
fallback:
  behavior: 'grace_with_alert' # block | grace_with_alert | default_tier
  defaultTier: 'FREE' # Required if behavior is "default_tier"
  alertChannels:
    - 'billing-alerts@neuronx.ai'
    - 'https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXXXXXX'
  gracePeriodDays: 7

# Audit and governance
auditEnabled: true
alertOnFallback: true
```

### Resolution Priority

1. **Environment Overrides**: Check for environment-specific mappings first
2. **Exact Product Match**: Match by GHL product ID
3. **SKU/Price/Variant Matching**: Additional validation if specified
4. **Fallback Behavior**: Configurable safety net with audit

### Fallback Behaviors

- **block**: Immediately block tenant access (safest)
- **grace_with_alert**: Allow access with FREE tier + alerts (balanced)
- **default_tier**: Use specified default tier with audit (lenient)

### Files Modified

- `packages/adapters/ghl-billing/src/policy/plan-mapping-policy.types.ts` (NEW)
- `config/plan-mapping-policy.yaml` (NEW)
- `packages/adapters/ghl-billing/src/policy/plan-mapping-policy.loader.ts` (NEW)
- `packages/adapters/ghl-billing/src/policy/plan-mapping-policy.resolver.ts` (NEW)
- `packages/adapters/ghl-billing/src/entitlement-sync.service.ts` (UPDATED)
- `packages/adapters/ghl-billing/src/types.ts` (REMOVED GhlProductMapping)
- `packages/adapters/ghl-billing/package.json` (UPDATED)
- `packages/adapters/ghl-billing/src/index.ts` (UPDATED)
- `packages/adapters/ghl-billing/src/policy/__tests__/plan-mapping-policy.loader.spec.ts` (NEW)
- `packages/adapters/ghl-billing/src/policy/__tests__/plan-mapping-policy.resolver.spec.ts` (NEW)

### Safety Guarantees

- **No Silent Fallbacks**: Unknown products never map implicitly
- **Explicit Configuration**: Every mapping must be declared
- **Audit Trail**: Every fallback usage is logged with full context
- **Alert System**: Configurable alerts for unmapped products
- **Fail-Fast Startup**: Invalid policy prevents system startup

### Audit Events

Fallback usage creates detailed audit logs:

```json
{
  "action": "plan_mapping_fallback_used",
  "resourceType": "billing_entitlement",
  "newValues": {
    "ghlProductId": "unknown_product",
    "resolvedPlanTier": "FREE",
    "fallbackReason": "Unmapped product - grace period (7 days)",
    "policyVersion": "1.0.0"
  },
  "changes": {
    "fallbackUsed": true,
    "mappingUsed": null
  }
}
```

## Acceptance Criteria

### Functional Requirements

- [x] Unknown GHL products cannot map to plans without explicit policy declaration
- [x] Environment overrides work correctly (staging/prod differences)
- [x] SKU/price/variant matching provides additional precision
- [x] Fallback behaviors are configurable and safe
- [x] Audit logging captures all fallback usage
- [x] Alert system notifies on unmapped products
- [x] Startup fails with invalid mapping policy
- [x] Policy changes require deployment (no runtime surprises)

### Quality Requirements

- [x] All tests pass including regression tests
- [x] No linting errors or type violations
- [x] Policy schema strictly validated
- [x] Error messages clear and actionable
- [x] Code comments mark policy-driven logic

### Enterprise Requirements

- [x] Configuration human-readable and editable
- [x] Changes auditable and version-controlled
- [x] Schema prevents invalid configurations
- [x] Fail-fast behavior prevents runtime surprises
- [x] Business rules validated beyond schema

## Testing Strategy

### Unit Tests

- Policy loader validation (valid/invalid configs, business rules)
- Policy resolver mapping logic and fallback behaviors
- SKU/price/variant matching accuracy
- Environment override precedence
- Audit event generation

### Integration Tests

- Full entitlement sync with policy resolution
- Fallback behavior end-to-end verification
- Audit log creation and correctness
- Alert system triggering

### Regression Tests

- Verify no env-based mapping logic remains
- Confirm all product resolution goes through policy
- Validate audit events are created for fallbacks
- Ensure GHL sync still works with policy changes

## Risk Mitigation

- **Silent Mapping Failures**: Explicit fallback behaviors prevent implicit mappings
- **Configuration Drift**: Strict schema validation prevents invalid configs
- **Audit Gaps**: Mandatory audit logging for all fallback usage
- **Alert Failures**: Multiple alert channels with fallback logging
- **Runtime Surprises**: Fail-fast startup prevents invalid policies

## Dependencies

- `js-yaml` for YAML parsing
- `zod` for runtime schema validation
- Existing Prisma audit logging
- GHL billing sync service (updated to use resolver)

## Rollback Plan

1. Restore GhlProductMapping interface in types.ts
2. Revert entitlement-sync.service.ts to use config.productMappings
3. Remove policy resolver injection
4. Restore env-based default tier logic
5. Update tests to use original mapping approach

## Success Metrics

- Zero unmapped products in production without explicit policy declaration
- 100% audit coverage for plan mapping decisions
- Zero silent fallbacks in production environment
- Successful startup with valid policy file
- Failed startup with invalid policy (fail-fast)
- Alert system working for unmapped products
