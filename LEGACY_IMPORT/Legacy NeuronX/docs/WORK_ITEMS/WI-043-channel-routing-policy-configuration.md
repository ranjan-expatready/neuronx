# WI-043: Channel Routing Policy Configuration

## Objective

Extract all channel routing logic from hardcoded code into a policy-driven YAML configuration system, enabling enterprise configurability and eliminating magic numbers.

## Scope

### In Scope

- Extract channel priority order from hardcoded arrays
- Extract risk-based channel constraints (critical → email)
- Extract deal value routing thresholds ($50k+ → WhatsApp)
- Extract SLA urgency overrides (urgent → SMS)
- Extract retry fallback rules (3+ retries → email)
- Create YAML schema with strict validation
- Implement policy loader with fail-fast startup validation
- Update DeterministicChannelRouter to use policy resolver
- Remove all hardcoded routing logic
- Add comprehensive tests proving no magic numbers remain

### Out of Scope

- Changing execution behavior (same inputs produce same outputs)
- Modifying GHL adapters or external integrations
- Adding new routing features or channels
- UI changes or operator workflow modifications

## Implementation Details

### Policy Schema

```yaml
# Channel priority order (highest to lowest)
channelPriorityOrder:
  - voice
  - sms
  - whatsapp
  - email
  - calendar

# Risk-based constraints (overrides for specific risk levels)
riskChannelConstraints:
  critical: email # Critical risk AI actions routed to email

# Deal value routing (higher value = better channels)
dealValueRouting:
  - minValue: 50000
    preferredChannel: whatsapp
    reason: 'High-value prospects contacted via WhatsApp'

# SLA urgency overrides (urgent items get faster channels)
slaUrgencyOverrides:
  - urgency: urgent
    commandTypes: ['SEND_MESSAGE']
    preferredChannel: sms
    reason: 'Urgent messages sent via SMS'

# Retry-based fallbacks (after failures, fallback to reliable channels)
retryFallbacks:
  - maxRetries: 3
    fallbackChannel: email
    reason: 'Excessive retries require human intervention via email'

# Human-only channel enforcement (empty in current implementation)
humanOnlyChannels: []

# Risk score thresholds for routing logic
riskScoreThresholds:
  critical: 80
  high: 60
  medium: 40
  low: 0

# Command fallback routing (when no rules match)
commandFallbacks:
  - commandType: 'EXECUTE_CONTACT'
    fallbackChannel: voice
    reason: 'Default contact execution via voice'
```

### Files Modified

- `packages/execution-authority/src/policy/channel-routing-policy.types.ts` (NEW)
- `config/channel-routing-policy.yaml` (NEW)
- `packages/execution-authority/src/policy/channel-routing-policy.loader.ts` (NEW)
- `packages/execution-authority/src/policy/channel-routing-policy.resolver.ts` (NEW)
- `packages/execution-authority/src/channel-router.ts` (UPDATED)
- `packages/execution-authority/src/execution-authority.ts` (UPDATED)
- `packages/execution-authority/package.json` (UPDATED)
- `packages/execution-authority/src/index.ts` (UPDATED)
- `packages/execution-authority/src/__tests__/channel-router.spec.ts` (UPDATED)
- `packages/execution-authority/src/policy/__tests__/channel-routing-policy.loader.spec.ts` (NEW)
- `packages/execution-authority/src/policy/__tests__/channel-routing-policy.resolver.spec.ts` (NEW)

### Routing Priority Logic

1. **SLA Urgency Overrides** (highest priority)
2. **Risk-based Channel Constraints**
3. **Deal Value Routing**
4. **Retry Fallbacks**
5. **Human-only Channel Requirements**
6. **Command Fallback Routing**

### Validation Rules

- Policy file must exist at startup
- All required fields must be present
- Channel names must be valid ExecutionChannel enums
- Thresholds must be numeric and in valid ranges
- Command types must match ExecutionCommand.commandType values

## Acceptance Criteria

### Functional Requirements

- [x] Same execution context inputs produce identical channel routing outputs
- [x] No hardcoded numeric thresholds remain in routing code
- [x] All routing decisions reference policy resolver
- [x] Startup fails fast with invalid policy configuration
- [x] Policy changes take effect without code deployment

### Quality Requirements

- [x] All tests pass including regression tests
- [x] No linting errors or type violations
- [x] Policy schema is strictly validated
- [x] Error messages are clear and actionable
- [x] Code comments mark policy-driven logic

### Enterprise Requirements

- [x] Configuration is human-readable and editable
- [x] Changes are auditable and version-controllable
- [x] Schema prevents invalid configurations
- [x] Fail-fast behavior prevents runtime surprises

## Testing Strategy

### Unit Tests

- Policy loader validation (valid/invalid configs)
- Policy resolver access methods
- Channel router policy-driven routing
- Risk level conversion accuracy
- Deterministic routing verification

### Integration Tests

- Full execution authority with policy injection
- Startup validation with malformed policy files

### Regression Tests

- Verify no magic numbers remain in codebase
- Confirm routing behavior matches original logic
- Validate all code paths use policy resolver

## Risk Mitigation

- **Configuration Drift**: Strict schema validation prevents invalid configs
- **Startup Failures**: Clear error messages guide configuration fixes
- **Behavioral Changes**: Tests ensure identical behavior with policy-driven logic
- **Performance Impact**: Policy is loaded once at startup, cached thereafter

## Dependencies

- `js-yaml` for YAML parsing
- `zod` for runtime schema validation
- Existing ExecutionAuthority and ChannelRouter interfaces

## Rollback Plan

1. Revert policy injection in ChannelRouter constructor
2. Restore hardcoded routing logic in routeChannel method
3. Remove policy-related files and dependencies
4. Update tests to use original hardcoded expectations
