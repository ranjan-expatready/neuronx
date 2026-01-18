# WI-040: Billing & Entitlements Authority

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX executes customer actions but has no billing or entitlement controls. This creates catastrophic revenue and compliance risks:

1. **No Usage Limits**: Customers can execute unlimited actions without payment
2. **No Entitlement Enforcement**: No way to enforce plan limits or tiers
3. **No Revenue Protection**: No mechanism to prevent usage without billing
4. **No Audit Trail**: No way to track usage for billing or compliance
5. **No Plan Management**: No way to define or enforce different plan tiers

This prevents NeuronX from being a commercial product that enterprises can confidently purchase.

## Solution Overview

Implement complete billing and entitlements authority:

1. **Centralized Billing Logic**: All billing decisions made in one place, never in adapters
2. **Entitlement Enforcement**: Hard limits on usage with configurable enforcement modes
3. **Usage Accounting**: Complete audit trail of all billable events
4. **Plan Management**: Hierarchical plan tiers with granular limits
5. **Execution Integration**: Billing checks happen before token issuance

**Non-Negotiable**: Billing logic is authoritative, non-bypassable, and revenue-protecting.

## Acceptance Criteria

### AC-040.01: Billing Architecture

- [x] Billing package created with clean separation of concerns
- [x] Billing logic centralized (not in adapters, UI, or external systems)
- [x] Database schema supports usage events and aggregated meters
- [x] Configuration supports multiple enforcement modes

### AC-040.02: Entitlement Enforcement

- [x] Entitlement checks happen BEFORE execution token issuance
- [x] Multiple enforcement modes: monitor_only, block, grace_period
- [x] Fail-closed behavior on billing system errors
- [x] Conservative usage estimation for voice calls

### AC-040.03: Usage Accounting

- [x] All billable events recorded with tenant isolation
- [x] Idempotent usage recording (safe for retries)
- [x] Monthly aggregated usage meters
- [x] Usage queries support auditing and reporting

### AC-040.04: Execution Integration

- [x] Billing checks integrated into ExecutionAuthority.planExecution()
- [x] Token issuance blocked when billing denies entitlement
- [x] Actual usage recorded after successful execution
- [x] Billing failures override execution planning

### AC-040.05: Plan Management

- [x] Hierarchical plan tiers (FREE, PRO, ENTERPRISE)
- [x] Granular limits per usage type
- [x] Unlimited support for enterprise plans
- [x] Plan lookup by tenant

### AC-040.06: Testing & Safety

- [x] Unit tests for entitlement evaluation (95%+ coverage)
- [x] Integration tests proving execution blocking
- [x] Usage accounting tests with idempotency
- [x] Error handling tests for fail-closed behavior

## Technical Implementation

### Billing Package Architecture

**Core Components:**

```typescript
// Types and schemas
export enum PlanTier { FREE = 'FREE', PRO = 'PRO', ENTERPRISE = 'ENTERPRISE' }
export enum UsageType { EXECUTION = 'EXECUTION', VOICE_MINUTE = 'VOICE_MINUTE', EXPERIMENT = 'EXPERIMENT' }
export enum EnforcementMode { MONITOR_ONLY = 'monitor_only', BLOCK = 'block', GRACE_PERIOD = 'grace_period' }

// Main services
export class EntitlementEvaluator    // Checks if usage allowed
export class UsageAggregator         // Records and aggregates usage
export class BillingGuard           // Integrates with execution flow
```

**Database Schema:**

```sql
-- Raw usage events
model UsageEvent {
  eventId       String   @id
  tenantId      String
  type          String   // EXECUTION | VOICE_MINUTE | EXPERIMENT
  quantity      Float
  correlationId String
  metadata      Json?
  occurredAt    DateTime

  @@index([tenantId, type, occurredAt])
  @@index([correlationId])
}

-- Aggregated usage meters
model UsageMeter {
  tenantId      String
  period        String   // YYYY-MM
  type          String
  totalQuantity Float    @default(0)
  lastUpdated   DateTime

  @@id([tenantId, period, type])
  @@index([tenantId, period])
}
```

### Entitlement Enforcement Flow

**Pre-Execution Check:**

```typescript
// In ExecutionAuthority.planExecution()
const billingDecision = await billingGuard.checkExecutionEntitlement({
  tenantId,
  executionCommand,
  decisionResult,
  correlationId,
});

if (!billingDecision.allowed) {
  return {
    ...plan,
    allowed: false,
    reason: `Billing: ${billingDecision.reason}`,
  };
}
```

**Usage Estimation:**

```typescript
// Voice calls estimated conservatively
switch (decisionResult.voiceMode) {
  case 'SCRIPTED':
    return 2; // minutes
  case 'CONVERSATIONAL':
    return 5; // minutes
  case 'HUMAN_ONLY':
    return 10; // minutes
  default:
    return 3; // minutes
}

// Non-voice = 1 execution unit
return 1;
```

**Post-Execution Recording:**

```typescript
// After successful execution
await billingGuard.recordExecutionUsage(
  tenantId,
  executionCommand,
  decisionResult,
  correlationId
);
```

### Enforcement Modes

**MONITOR_ONLY:**

```typescript
// Always allow, log violations
if (wouldExceed) {
  reason = `Monitor mode: would exceed ${usageType} limit`;
}
return { allowed: true, reason };
```

**BLOCK:**

```typescript
// Hard stop at limits
if (wouldExceed) {
  reason = `Would exceed ${usageType} limit (${newUsage}/${limit})`;
  return { allowed: false, reason };
}
return { allowed: true, reason: 'Within limits' };
```

**GRACE_PERIOD:**

```typescript
// Allow but warn (for migration periods)
if (wouldExceed) {
  reason = `Grace period: exceeded ${usageType} limit`;
}
return { allowed: true, reason };
```

### Plan Hierarchy

**Default Plans:**

```typescript
FREE: {
  executionsPerMonth: 100,
  voiceMinutesPerMonth: 10,
  experimentsPerMonth: 1,
  teams: 1,
  operators: 1
}

PRO: {
  executionsPerMonth: 1000,
  voiceMinutesPerMonth: 100,
  experimentsPerMonth: 10,
  teams: 3,
  operators: 5
}

ENTERPRISE: {
  // All -1 (unlimited)
  executionsPerMonth: -1,
  voiceMinutesPerMonth: -1,
  experimentsPerMonth: -1,
  teams: -1,
  operators: -1
}
```

**Limit Checking:**

```typescript
if (limit === -1) return true; // Unlimited
return currentUsage + quantity <= limit;
```

### Integration Points

**ExecutionAuthority.planExecution():**

```typescript
async planExecution(context: ExecutionContext): Promise<ExecutionPlan> {
  const plan = await this.decisionEngine.planExecution(context);

  // WI-040: Check billing entitlement
  if (plan.allowed) {
    const billingDecision = await this.billingGuard.checkExecutionEntitlement({
      tenantId: context.tenantId,
      executionCommand: context.executionCommand,
      decisionResult: context.decisionResult,
      correlationId: context.correlationId
    });

    if (!billingDecision.allowed) {
      return {
        ...plan,
        allowed: false,
        reason: `Billing: ${billingDecision.reason}`
      };
    }
  }

  return plan;
}
```

**ExecutionAuthority.issueToken():**

```typescript
async issueToken(plan: ExecutionPlan, issuedBy: string): Promise<ExecutionToken> {
  // Only issue if billing allowed
  if (!plan.allowed && plan.reason?.startsWith('Billing:')) {
    throw new Error(`Cannot issue token: ${plan.reason}`);
  }

  // Issue token...
}
```

### Usage Accounting

**Event Recording:**

```typescript
await usageAggregator.recordUsage({
  eventId: `exec_${correlationId}`,
  tenantId,
  type: usageType,
  quantity: estimatedQuantity,
  correlationId,
  metadata: {
    commandType: executionCommand.commandType,
    channel: executionCommand.channel,
    voiceMode: decisionResult.voiceMode,
  },
  occurredAt: new Date(),
});
```

**Meter Aggregation:**

```typescript
// Automatic aggregation on event recording
const period = `${occurredAt.getFullYear()}-${String(occurredAt.getMonth() + 1).padStart(2, '0')}`;

await prisma.usageMeter.upsert({
  where: { tenantId_period_type: { tenantId, period, type } },
  update: { totalQuantity: { increment: quantity } },
  create: { tenantId, period, type, totalQuantity: quantity },
});
```

### Configuration

**Environment Variables:**

```bash
BILLING_ENFORCEMENT_MODE=monitor_only|block|grace_period
BILLING_DEFAULT_PLAN_TIER=FREE|PRO|ENTERPRISE
BILLING_ENABLE_USAGE_TRACKING=true|false
BILLING_ENABLE_AUDIT_LOGGING=true|false
BILLING_GRACE_PERIOD_DAYS=7
```

**Runtime Configuration:**

```typescript
const config = new BillingConfigService();
const evaluator = new EntitlementEvaluator(prisma, config.getEnforcementMode());
```

## Threat Model & Abuse Scenarios

### Abuse Scenario 1: Usage Gaming

**Attack:** Customer attempts to execute many small actions to stay under limits
**Defense:** Per-action billing with no aggregation gaming possible

### Abuse Scenario 2: Concurrent Execution

**Attack:** Multiple parallel executions to exceed limits
**Defense:** Real-time usage checking against current aggregated usage

### Abuse Scenario 3: System Errors

**Attack:** Exploit billing system errors to bypass limits
**Defense:** Fail-closed behavior - errors block execution

### Abuse Scenario 4: Meter Tampering

**Attack:** Attempt to manipulate usage meters
**Defense:** Database constraints, audit trails, idempotent operations

### Abuse Scenario 5: Plan Downgrade Attacks

**Attack:** Downgrade plan mid-month to avoid charges
**Defense:** Usage continues to be tracked, charged at actual usage rates

## Testing Strategy

### Unit Tests (95%+ Coverage)

- **EntitlementEvaluator:** All enforcement modes, limit checking, error handling
- **UsageAggregator:** Event recording, meter aggregation, query operations
- **BillingGuard:** Integration logic, usage estimation, error handling

### Integration Tests

- **Execution Blocking:** Verify token issuance fails when billing denies
- **Usage Recording:** Confirm usage events created after successful execution
- **Limit Enforcement:** Test various enforcement modes in real scenarios
- **Idempotency:** Ensure safe retry behavior

### End-to-End Tests

- **Complete Flow:** planExecution → billing check → token issuance → execution → usage recording
- **Limit Exceedance:** Verify blocking when limits reached
- **Multi-Tenant:** Ensure tenant isolation in billing operations

## Success Metrics

### Technical Metrics

- **Billing Check Latency:** <50ms average response time
- **Usage Recording Success:** >99.99% successful recordings
- **False Positives:** 0% (no incorrect billing denials)
- **False Negatives:** 0% (no unbilled usage)

### Business Metrics

- **Revenue Protection:** 100% of executions are billable or blocked
- **Limit Enforcement:** 100% compliance with plan limits
- **Audit Completeness:** 100% of usage events auditable
- **Customer Satisfaction:** No billing surprises for customers

## Future Extensions

### Advanced Features

- **Real-time Billing:** Streaming usage updates to external billing systems
- **Custom Plans:** API for creating custom plan configurations
- **Usage Alerts:** Proactive notifications when approaching limits
- **Cost Estimation:** Pre-execution cost calculation
- **Billing Cycles:** Flexible billing periods beyond monthly

### Enterprise Features

- **Cost Centers:** Allocate usage to departments/projects
- **Budget Controls:** Spending limits and approval workflows
- **Usage Analytics:** Detailed reporting and forecasting
- **Bulk Operations:** Plan changes and limit adjustments
- **Compliance Exports:** Audit-ready billing reports

## Implementation Notes

### Database Performance

```sql
-- Indexes for fast billing checks
CREATE INDEX idx_usage_meter_tenant_period ON usage_meters(tenantId, period);
CREATE INDEX idx_usage_event_tenant_type_time ON usage_events(tenantId, type, occurredAt);
CREATE INDEX idx_usage_event_correlation ON usage_events(correlationId);

-- Partitioning strategy for large tenants
-- Monthly partitions on usage_events and usage_meters
```

### Monitoring & Alerting

```typescript
// Key metrics
billing_checks_total{result, mode}
// Usage recording
billing_usage_recorded_total{type}
// Limit enforcement
billing_limits_exceeded_total{plan_tier}
// Performance
billing_check_duration_seconds
```

### Rollback Strategy

```typescript
// Soft delete usage events
UPDATE usage_events SET deleted = true WHERE tenantId = ?;

// Revert meter aggregation
UPDATE usage_meters SET totalQuantity = totalQuantity - ? WHERE ...;

// Emergency disable
BILLING_ENFORCEMENT_MODE=monitor_only
```

This implementation transforms NeuronX from having "unlimited execution risk" to having "enterprise-grade billing protection" that enables confident commercial operation.
