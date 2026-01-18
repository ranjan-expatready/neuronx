# WI-044: Billing Plan & Limit Configuration

## Objective

Extract all hardcoded billing limits, quotas, and enforcement behavior from the billing-entitlements package into a policy-driven YAML configuration system, enabling enterprise configurability while maintaining GHL's ownership of money and subscription lifecycle.

## Scope

### In Scope

- Extract plan limits (executions, voice minutes, experiments, teams, operators) from DEFAULT_PLANS
- Extract enforcement mode defaults (monitor_only, grace, block) per plan tier
- Extract grace period durations and warning thresholds
- Extract voice minute estimation logic by voice mode (SCRIPTED, CONVERSATIONAL, HUMAN_ONLY)
- Extract usage type mappings for different channels
- Create YAML schema with strict validation
- Implement policy loader with fail-fast startup validation
- Update billing-entitlements package to use policy resolver
- Remove all hardcoded limits and enforcement logic
- Add comprehensive tests proving no magic numbers remain

### Out of Scope

- Changing GHL billing webhook sync logic
- Modifying Stripe integration or payment processing
- Adding new billing features or pricing logic
- Changing subscription lifecycle management

## Implementation Details

### Policy Schema

```yaml
# Plan configurations with limits and enforcement
plans:
  FREE:
    name: 'Free Plan'
    limits:
      executionsPerMonth: 100
      voiceMinutesPerMonth: 10
      experimentsPerMonth: 1
      teams: 1
      operators: 1
    enforcementMode: 'block'
    gracePeriodDays: 0
    warningThresholds: [80, 95] # Custom thresholds per plan

  PRO:
    name: 'Pro Plan'
    limits:
      executionsPerMonth: 1000
      voiceMinutesPerMonth: 100
      experimentsPerMonth: 10
      teams: 3
      operators: 5
    enforcementMode: 'grace_period'
    gracePeriodDays: 7
    warningThresholds: [80, 90, 95]

  ENTERPRISE:
    name: 'Enterprise Plan'
    limits:
      executionsPerMonth: -1 # Unlimited
      voiceMinutesPerMonth: -1
      experimentsPerMonth: -1
      teams: -1
      operators: -1
    enforcementMode: 'monitor_only'
    gracePeriodDays: 30
    warningThresholds: [90]

# Usage extraction and estimation rules
usageExtraction:
  # Voice minute estimates by mode (conservative estimates)
  voiceEstimates:
    - voiceMode: 'SCRIPTED'
      estimatedMinutes: 2
    - voiceMode: 'CONVERSATIONAL'
      estimatedMinutes: 5
    - voiceMode: 'HUMAN_ONLY'
      estimatedMinutes: 10

  # Usage type mappings for different channels
  usageTypeMappings:
    - channels: ['voice']
      usageType: 'VOICE_MINUTE'
      quantity: 0 # Quantity determined by voice estimates above
    - channels: ['email', 'sms', 'whatsapp', 'calendar']
      usageType: 'EXECUTION'
      quantity: 1 # Each execution counts as 1

# Enforcement behavior defaults
enforcement:
  defaultEnforcementMode: 'monitor_only'
  defaultGracePeriodDays: 7
  failClosedOnErrors: true

# Global warning thresholds (percentage-based)
warningThresholds:
  softWarning: 80 # Warning at 80% usage
  hardWarning: 90 # Hard warning at 90% usage
  criticalWarning: 95 # Critical warning at 95% usage
```

### Files Modified

- `packages/billing-entitlements/src/policy/billing-policy.types.ts` (NEW)
- `config/billing-policy.yaml` (NEW)
- `packages/billing-entitlements/src/policy/billing-policy.loader.ts` (NEW)
- `packages/billing-entitlements/src/policy/billing-policy.resolver.ts` (NEW)
- `packages/billing-entitlements/src/entitlement-evaluator.ts` (UPDATED)
- `packages/billing-entitlements/src/billing-guard.ts` (UPDATED)
- `packages/billing-entitlements/src/types.ts` (REMOVED DEFAULT_PLANS)
- `packages/billing-entitlements/package.json` (UPDATED)
- `packages/billing-entitlements/src/index.ts` (UPDATED)
- `packages/billing-entitlements/src/__tests__/billing-guard.spec.ts` (UPDATED)
- `packages/billing-entitlements/src/policy/__tests__/billing-policy.loader.spec.ts` (NEW)
- `packages/billing-entitlements/src/policy/__tests__/billing-policy.resolver.spec.ts` (NEW)

### Key Architecture Changes

#### Plan Limits Extraction

**Before:** Hardcoded in DEFAULT_PLANS constant

```typescript
export const DEFAULT_PLANS = {
  FREE: { limits: { executionsPerMonth: 100, ... } }
}
```

**After:** Policy-driven configuration

```typescript
// Policy resolver provides limits per plan tier
const limits = policyResolver.getPlanLimits(planTier);
```

#### Voice Minute Estimation

**Before:** Hardcoded switch statement

```typescript
switch (voiceMode) {
  case 'SCRIPTED':
    return 2;
  case 'CONVERSATIONAL':
    return 5;
  case 'HUMAN_ONLY':
    return 10;
}
```

**After:** Policy-driven estimation

```typescript
const estimatedMinutes = policyResolver.getVoiceMinuteEstimate(voiceMode);
```

#### Enforcement Behavior

**Before:** Constructor parameter or hardcoded defaults

```typescript
constructor(enforcementMode: EnforcementMode = 'monitor_only')
```

**After:** Per-plan enforcement modes from policy

```typescript
const enforcementMode = policyResolver.getPlanEnforcementMode(planTier);
```

### Usage Type Mapping

Channels are mapped to usage types with configurable quantities:

- Voice channels → VOICE_MINUTE (quantity from voice estimates)
- Other channels → EXECUTION (fixed quantity: 1)

## Acceptance Criteria

### Functional Requirements

- [x] Same billing decisions for identical inputs (deterministic behavior)
- [x] No hardcoded numeric limits remain in billing logic
- [x] All enforcement behavior references policy resolver
- [x] Startup fails fast with invalid billing policy
- [x] GHL billing sync remains unchanged
- [x] Unlimited plans (-1 values) handled correctly
- [x] Voice minute estimation uses policy values
- [x] Warning thresholds configurable per plan

### Quality Requirements

- [x] All tests pass including regression tests
- [x] No linting errors or type violations
- [x] Policy schema strictly validated
- [x] Error messages clear and actionable
- [x] Code comments mark policy-driven logic

### Enterprise Requirements

- [x] Configuration human-readable and editable
- [x] Changes auditable and version-controllable
- [x] Schema prevents invalid configurations
- [x] Fail-fast behavior prevents runtime surprises
- [x] Graceful handling of unlimited plans

## Testing Strategy

### Unit Tests

- Policy loader validation (valid/invalid configs)
- Policy resolver access methods and calculations
- Voice minute estimation accuracy
- Warning level calculation correctness
- Unlimited plan handling

### Integration Tests

- Full entitlement evaluation with policy injection
- Billing guard usage extraction with policy
- Startup validation with malformed policy files

### Regression Tests

- Verify no magic numbers remain in billing package
- Confirm enforcement behavior matches original logic
- Validate all code paths use policy resolver

## Risk Mitigation

- **Configuration Drift**: Strict schema validation prevents invalid configs
- **Billing Failures**: Fail-closed behavior on errors (configurable)
- **Usage Inaccuracy**: Conservative voice minute estimates prevent under-billing
- **Enterprise Compliance**: Unlimited plans properly handled for enterprise tiers

## Dependencies

- `js-yaml` for YAML parsing
- `zod` for runtime schema validation
- Existing Prisma usage meter schema
- GHL billing sync service (unchanged)

## Rollback Plan

1. Restore DEFAULT_PLANS constant in types.ts
2. Revert policy injection in entitlement-evaluator and billing-guard
3. Restore hardcoded voice minute estimates
4. Update factory functions to use enforcement mode parameter
5. Remove policy-related files and dependencies

## Success Metrics

- Zero hardcoded limits in billing-entitlements package
- 100% policy-driven enforcement behavior
- Successful startup with valid policy file
- Failed startup with invalid policy (fail-fast)
- Deterministic billing decisions across deployments
