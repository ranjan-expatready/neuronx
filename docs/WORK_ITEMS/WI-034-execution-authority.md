# WI-034: Multi-Channel Execution Authority + Tokenized Actor Model

**Status:** 🟢 Active
**Created:** 2026-01-05
**Priority:** Critical
**Assigned:** Cursor Agent

## Problem Statement

NeuronX can now execute voice calls safely, but lacks:

1. **Multi-Channel Authority**: External systems (GHL, Twilio) can still influence execution channels - violating REQ-002
2. **Tokenized Security**: Side effects (calls, messages, meetings) occur without secure, auditable authorization - violating REQ-016
3. **Adapter Boundaries**: No enforced contract testing between NeuronX and adapters - violating REQ-018

This creates security gaps where:

- Malicious actors could trigger executions without proper authorization
- Channel decisions could be manipulated externally
- Side effects could occur without audit trails
- Adapter boundaries could be bypassed

## Solution Overview

Implement complete execution authority with secure tokenization:

1. **Execution Authority**: Single source of truth for all multi-channel execution decisions
2. **Channel Router**: Deterministic, NeuronX-controlled channel selection
3. **Token Lifecycle**: Secure, short-lived tokens for side effect authorization
4. **Adapter Contracts**: Enforced boundaries with automated testing
5. **Operator Control**: Human approval workflows for high-risk executions

**Non-Negotiable**: All execution authority resides in NeuronX. Adapters are dumb pipes.

## Acceptance Criteria

### AC-034.01: Multi-Channel Authority (REQ-002)

- [x] Channel router deterministically selects channels based only on NeuronX inputs
- [x] External systems cannot influence channel selection
- [x] Same inputs always produce same channel output
- [x] Channel selection includes risk assessment and SLA requirements

### AC-034.02: Tokenized Security (REQ-016)

- [x] Execution tokens required for all side effects when enabled
- [x] Tokens are short-lived (10 minutes default), scoped, and one-time use
- [x] Token verification includes expiry, scope, and usage checks
- [x] Token consumption is idempotent and race-safe
- [x] Missing/invalid/expired tokens block execution

### AC-034.03: Adapter Contract Enforcement (REQ-018)

- [x] Adapters require valid execution tokens when enabled
- [x] Contract tests verify adapter boundaries cannot be bypassed
- [x] Direct adapter calls without tokens are rejected
- [x] Adapter responses include token verification status

### AC-034.04: Human-in-Loop Workflows

- [x] APPROVAL_REQUIRED executions appear in Operator UI work queue
- [x] Operators can approve/reject executions with audit trails
- [x] Token issuance requires operator authentication
- [x] Emergency token revocation available to administrators

### AC-034.05: Enterprise Observability

- [x] Execution planning metrics (channel, actor, mode, allowed)
- [x] Token lifecycle metrics (issued, verified, rejected, revoked)
- [x] Side effect execution metrics with success/failure tracking
- [x] All metrics tenant-safe (no tenant IDs in labels)

## Technical Implementation

### Execution Authority Architecture

```
PlaybookEngine → ExecutionAuthority.planExecution() → ExecutionPlan
                     ↓
DecisionEngine → Risk Assessment + Actor Selection
                     ↓
ChannelRouter → Deterministic Channel Selection
                     ↓
TokenService → Issue Token (if required)
                     ↓
Adapter Execution (with token verification)
```

### Channel Routing Logic

**Deterministic Rules** (priority order):

1. **Critical Risk**: AI → Email (human review)
2. **Urgent SLA**: Messages → SMS
3. **High-Value Deals**: Messages → WhatsApp
4. **Voice Execution**: Contact → Voice (when allowed)
5. **Meeting Scheduling**: → Calendar
6. **Default**: Messages → Email

**Inputs Considered**:

- Command type (EXECUTE_CONTACT, SEND_MESSAGE, SCHEDULE_MEETING)
- Actor (AI/HUMAN/HYBRID)
- Risk score and level
- Deal value
- SLA urgency
- Retry count
- Current stage

### Token Lifecycle

**Token Creation**:

```typescript
token = {
  tokenId: randomUUID(),
  tenantId,
  opportunityId,
  actorType,
  mode,
  channelScope,
  commandType,
  correlationId,
  expiresAt: now + 10min,
  createdBy
}
```

**Token Verification**:

- ✅ Exists in database
- ✅ Not expired
- ✅ Not used
- ✅ Not revoked
- ✅ Channel scope matches
- ✅ Command type matches

**Token Consumption**:

- Idempotent (first caller wins)
- Race-safe via database constraints
- Audited with user context

### Adapter Contract Enforcement

**Contract Requirements**:

- Adapters MUST verify tokens when `EXECUTION_TOKENS_ENABLED=true`
- Invalid tokens → immediate rejection
- Token verification failures → audit events
- Successful executions → mark token as used

**Test Contracts**:

```typescript
// Contract test pattern
describe('Adapter Token Enforcement', () => {
  it('rejects execution without valid token when enabled', async () => {
    // Arrange: Enable tokens, provide invalid token
    // Act: Call adapter execution
    // Assert: Rejected with clear error
  });
});
```

## Artifacts Produced

### Code Artifacts

- [x] `packages/execution-authority/` - Complete execution authority package
- [x] `ChannelRouter` - Deterministic channel selection
- [x] `ExecutionTokenService` - Secure token lifecycle
- [x] `NeuronXExecutionAuthority` - Main orchestration service
- [x] `apps/core-api/src/execution/` - REST endpoints and services
- [x] `POST /api/execution/plan` - Plan execution
- [x] `POST /api/execution/approve` - Human approval workflow
- [x] `POST /api/execution/execute` - Token-verified execution
- [x] Prisma models: `ExecutionToken`, `IdempotencyRecord`

### Test Artifacts

- [x] Unit tests for channel routing determinism
- [x] Token lifecycle tests (issue/verify/consume/revoke)
- [x] Adapter contract enforcement tests
- [x] End-to-end execution planning tests
- [x] Idempotency and race condition tests

### Documentation Artifacts

- [x] Threat model for token replay and adapter boundary attacks
- [x] Channel routing decision matrix
- [x] Token security guarantees and lifecycle
- [x] Operator approval workflow documentation
- [x] Adapter integration contract specifications

## Dependencies

- **WI-027**: Stage Gate (provides stage context)
- **WI-028**: Playbook Engine (provides execution commands)
- **WI-029**: Decision Engine (provides actor/mode decisions)
- **WI-032**: Operator UI (integrates approval workflows)
- **WI-033**: Voice Adapter (first adapter with token enforcement)

## Risk Mitigation

### Security Risks

- **Token Replay**: Short expiry + one-time use + scope validation
- **Race Conditions**: Database constraints + idempotent operations
- **Privilege Escalation**: Strict scope validation + audit trails
- **Adapter Bypass**: Contract tests + feature flags
- **Denial of Service**: Rate limiting + monitoring

### Operational Risks

- **Token Expiry**: Clear error messages + retry guidance
- **Idempotency Failures**: Comprehensive logging + monitoring
- **Channel Routing Errors**: Extensive testing + monitoring
- **Operator Workload**: Approval queue monitoring + alerting
- **Performance Impact**: Database query optimization + caching

## Success Metrics

- **Security**: 100% of side effects require valid tokens when enabled
- **Authority**: 100% channel decisions made by NeuronX routing logic
- **Reliability**: >99.9% token verification success rate
- **Performance**: <100ms average execution planning time
- **Operator Efficiency**: <5 minute average approval time
- **Audit Coverage**: 100% of executions have complete audit trails

## Future Extensions

- Advanced channel routing ML models
- Cross-channel orchestration (SMS → Voice fallback)
- Token delegation for service accounts
- Real-time execution monitoring dashboard
- Automated approval rules based on risk scoring
- Integration with external approval systems

## Implementation Notes

### Database Schema

```sql
-- Execution tokens with strict constraints
CREATE TABLE execution_tokens (
  tokenId TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  opportunityId TEXT NOT NULL,
  -- ... other fields
  UNIQUE(tenantId, correlationId, commandType)
);

-- Idempotency records for safe retries
CREATE TABLE idempotency_records (
  idempotencyKey TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  -- ... response caching
);
```

### Feature Flags

```typescript
EXECUTION_TOKENS_ENABLED = true; // Enable token requirements
EXECUTION_ROUTING_ENABLED = true; // Enable channel routing
EXECUTION_AUDIT_ENABLED = true; // Enable audit logging
```

### Monitoring

```typescript
// Key metrics to monitor
neuronx_execution_plan_total{channel,actor,mode,allowed}
// Token lifecycle
neuronx_execution_token_issued_total{channel,actor}
neuronx_execution_token_rejected_total{reason}
// Side effects
neuronx_execution_side_effect_total{channel,status}
```

This implementation establishes NeuronX as the complete authority for all execution decisions, with enterprise-grade security, auditability, and reliability.
