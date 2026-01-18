# WI-029: Decision Engine & Actor Orchestration

**Status:** ✅ COMPLETED
**Date:** 2026-01-05
**Assignee:** Cursor Agent

## Objective

Transform NeuronX from a "rule engine" into a production operating system by implementing authoritative decision-making about WHO executes, HOW it's done, and under WHAT constraints. This is the critical executive layer that makes AI safe and humans scalable.

## Scope

### ✅ COMPLETED

- **Decision Engine Core**: Main orchestration engine with comprehensive decision logic
- **Actor Selection**: AI vs Human vs Hybrid execution based on risk assessment
- **Voice Mode Selection**: Scripted vs Conversational AI with safety constraints
- **Risk Gate**: Multi-dimensional risk assessment (deal value, customer risk, SLA, evidence)
- **Enforcement Modes**: monitor_only, block, block_and_revert (fail-safe defaults)
- **Fail-Safe Logic**: Human-only fallback on decision engine errors
- **Comprehensive Testing**: Unit tests for all decision scenarios and edge cases
- **Enterprise Audit**: Structured logging with full decision context and reasoning

### ❌ EXCLUDED

- UI for decision configuration
- Real-time decision monitoring dashboards
- ML-based decision optimization
- External system integration for enforcement
- Decision replay/debugging interfaces

## Deliverables

### 1. Decision Engine Package (`packages/decision-engine/`)

#### Core Architecture

- **`DecisionEngine`**: Main orchestration interface with enforcement modes
- **`DecisionContext`**: Immutable input structure with validation
- **`DecisionResult`**: Immutable output with audit trail
- **`RiskGate`**: Multi-dimensional risk assessment engine
- **`ActorSelector`**: Intelligent actor selection (AI/Human/Hybrid)
- **`VoiceModeSelector`**: Safe voice interaction mode selection

#### Decision Context (Authoritative Inputs)

```typescript
interface DecisionContext {
  tenantId: string;
  opportunityId: string;
  stageId: string;
  executionCommand: ExecutionCommand; // From Playbook Engine
  dealValue?: number;
  customerRiskScore?: number;
  slaUrgency: 'low' | 'normal' | 'high' | 'critical';
  retryCount: number;
  evidenceSoFar: EvidenceType[];
  playbookVersion: string;
  correlationId: string;
  requestedAt: Date;
}
```

#### Decision Result (Immutable Outputs)

```typescript
interface DecisionResult {
  allowed: boolean;
  reason: string; // Audit explanation
  actor: 'AI' | 'HUMAN' | 'HYBRID';
  mode: 'AUTONOMOUS' | 'ASSISTED' | 'APPROVAL_REQUIRED';
  voiceMode?: 'SCRIPTED' | 'CONVERSATIONAL';
  escalationRequired: boolean;
  executionConstraints: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decidedAt: Date;
  correlationId: string;
  decisionEngineVersion: string;
}
```

### 2. Risk Assessment Engine

#### Multi-Dimensional Risk Calculation

- **Deal Value Risk**: High-value deals require human oversight
- **Customer Risk**: High-risk customers block AI voice interactions
- **SLA Urgency**: Critical SLAs require immediate human attention
- **Retry Risk**: Multiple failures suggest human intervention needed
- **Evidence Risk**: Negative evidence (complaints, failures) increases risk
- **Command Risk**: Voice interactions have higher inherent risk

#### Risk Hierarchy

```typescript
enum RiskLevel {
  LOW = 'LOW', // AI autonomous execution allowed
  MEDIUM = 'MEDIUM', // Assisted execution recommended
  HIGH = 'HIGH', // Human execution required
  CRITICAL = 'CRITICAL', // Approval required, escalation mandatory
}
```

### 3. Actor Selection Intelligence

#### Actor Capability Assessment

- **AI Actor**: Fast, consistent, but blocked for high-risk scenarios
- **Human Actor**: Reliable for complex situations, slower but trustworthy
- **Hybrid Actor**: AI-assisted human for medium-risk scenarios

#### Selection Logic Priority

1. **Human** (most trustworthy for high-stakes)
2. **Hybrid** (balanced approach for medium-risk)
3. **AI** (fastest for low-risk, high-confidence scenarios)

### 4. Voice Safety Controls

#### Voice Mode Selection

- **Scripted AI**: Approved scripts, limited deviation, high safety
- **Conversational AI**: LLM-driven but bounded, medium safety
- **Human Only**: No AI voice interaction allowed

#### Voice Blocking Criteria

- Critical risk situations
- High-value deals (>$100K)
- High-risk customers (>80% risk score)
- Multiple retry attempts
- Negative evidence (complaints, failures)

### 5. Enforcement Architecture

#### Enforcement Modes

- **`monitor_only`**: Log decisions but allow all execution (safe default)
- **`block`**: Prevent invalid decisions, enforce safety rules
- **`block_and_revert`**: Block + attempt to correct external state

#### Fail-Safe Defaults

- **Decision Engine Errors**: Force human-assisted execution
- **Missing Context**: Conservative risk assessment (assume high risk)
- **Invalid Inputs**: Block execution with detailed error logging

## Business Rules Engine

### Decision Logic Matrix

| Risk Level | Deal Value  | Customer Risk | SLA      | AI Allowed | Human Required | Mode       | Voice          |
| ---------- | ----------- | ------------- | -------- | ---------- | -------------- | ---------- | -------------- |
| LOW        | <$10K       | <40%          | Normal   | ✅         | ❌             | AUTONOMOUS | CONVERSATIONAL |
| MEDIUM     | $10K-$100K  | 40-60%        | High     | ⚠️         | ❌             | ASSISTED   | SCRIPTED       |
| HIGH       | $100K-$500K | 60-80%        | Critical | ❌         | ✅             | APPROVAL   | HUMAN ONLY     |
| CRITICAL   | >$500K      | >80%          | Critical | ❌         | ✅             | APPROVAL   | HUMAN ONLY     |

### Actor Selection Rules

#### AI Actor Allowed When:

- Risk level ≤ MEDIUM
- Deal value ≤ $100K
- Customer risk ≤ 60%
- No negative evidence
- Command allows AI execution
- Retry count ≤ 2

#### Human Actor Required When:

- Risk level = HIGH or CRITICAL
- Deal value > $100K
- Customer risk > 80%
- Critical SLA urgency
- Command requires human execution

#### Hybrid Actor For:

- Medium risk scenarios
- Complex commands needing oversight
- Voice interactions (AI + human supervision)

## Implementation Architecture

### Package Structure

```
packages/decision-engine/
├── src/
│   ├── types.ts                    # Core type definitions
│   ├── decision-context.ts         # Context building & validation
│   ├── decision-engine.ts          # Main orchestration engine
│   ├── risk-gate.ts               # Risk assessment logic
│   ├── actor-selector.ts          # Actor selection intelligence
│   ├── voice-mode-selector.ts     # Voice safety controls
│   ├── index.ts                   # Package exports
│   └── __tests__/                 # Comprehensive test suite
```

### Integration Points (Future)

- **Playbook Engine**: Receives ExecutionCommand, returns enriched commands
- **GHL Webhook Processing**: Decision validation before command execution
- **Voice Processing**: Real-time decision enforcement
- **Audit System**: Decision logging and compliance reporting

## Files Created Summary

### Core Implementation

- **`packages/decision-engine/src/types.ts`** - Complete type system with 15+ interfaces
- **`packages/decision-engine/src/decision-engine.ts`** - Main orchestration with 200+ lines
- **`packages/decision-engine/src/risk-gate.ts`** - Multi-dimensional risk assessment
- **`packages/decision-engine/src/actor-selector.ts`** - Intelligent actor selection
- **`packages/decision-engine/src/voice-mode-selector.ts`** - Voice safety controls
- **`packages/decision-engine/src/decision-context.ts`** - Context validation and building

### Test Suite

- **`src/__tests__/decision-engine.spec.ts`** - Main engine orchestration tests
- **`src/__tests__/risk-gate.spec.ts`** - Risk assessment edge cases
- **`src/__tests__/actor-selector.spec.ts`** - Actor selection logic
- **`src/__tests__/voice-mode-selector.spec.ts`** - Voice safety scenarios

### Documentation

- **`docs/WORK_ITEMS/WI-029-decision-engine.md`** - Complete specification
- **`docs/TRACEABILITY.md`** - Updated with WI-029 mappings
- **`docs/WORK_ITEMS/INDEX.md`** - Added WI-029 entry

## Commands Executed & Results

### Build & Test Commands

```bash
cd packages/decision-engine
npm run build
# ✅ Result: TypeScript compilation successful - 0 errors

npm test
# ✅ Result: All unit tests pass (4 test suites, 20+ test cases)
```

### Test Coverage Examples

#### Risk Assessment Tests

```typescript
// Critical risk detection
it('should assess critical risk for high-value + high-risk combo', () => {
  // Deal: $150K, Customer: 85% risk, Critical SLA, 3 retries
  const assessment = riskGate.assessRisk(context, config);
  expect(assessment.overallRisk).toBe('CRITICAL');
  expect(assessment.mitigationRequired).toBe(true);
});
```

#### Actor Selection Tests

```typescript
// Priority-based selection
it('should select human for high-risk, AI for low-risk', () => {
  const highRiskCapability = actorSelector.selectActor(
    highRiskContext,
    highRiskAssessment,
    config
  );
  const lowRiskCapability = actorSelector.selectActor(
    lowRiskContext,
    lowRiskAssessment,
    config
  );

  expect(highRiskCapability.actorType).toBe('HUMAN');
  expect(lowRiskCapability.actorType).toBe('AI');
});
```

#### Voice Safety Tests

```typescript
// Voice blocking for dangerous scenarios
it('should block voice for critical risk + high-value deals', () => {
  const result = voiceSelector.isVoiceAllowed(
    criticalContext,
    criticalAssessment,
    config
  );
  expect(result.allowed).toBe(false);
  expect(result.reason).toContain('Voice interactions not allowed');
});
```

## Decision Engine Behavior Examples

### Low-Risk Scenario (AI Autonomous)

```json
{
  "input": {
    "dealValue": 5000,
    "customerRiskScore": 0.2,
    "slaUrgency": "normal",
    "retryCount": 0,
    "channel": "email"
  },
  "decision": {
    "allowed": true,
    "actor": "AI",
    "mode": "AUTONOMOUS",
    "riskLevel": "LOW",
    "reason": "Risk level: LOW | Selected actor: AI | Actor confidence: 95%"
  }
}
```

### High-Risk Scenario (Human with Approval)

```json
{
  "input": {
    "dealValue": 150000,
    "customerRiskScore": 0.85,
    "slaUrgency": "critical",
    "retryCount": 3,
    "channel": "voice",
    "evidenceSoFar": ["call_failed", "complaint"]
  },
  "decision": {
    "allowed": false,
    "actor": "HUMAN",
    "mode": "APPROVAL_REQUIRED",
    "escalationRequired": true,
    "riskLevel": "CRITICAL",
    "executionConstraints": [
      "Voice interactions not allowed for critical risk situations",
      "High-value opportunity: $150,000 deal requires careful handling"
    ]
  }
}
```

### Medium-Risk Scenario (Hybrid Assisted)

```json
{
  "input": {
    "dealValue": 25000,
    "customerRiskScore": 0.5,
    "slaUrgency": "high",
    "retryCount": 1,
    "channel": "voice"
  },
  "decision": {
    "allowed": true,
    "actor": "HYBRID",
    "mode": "ASSISTED",
    "voiceMode": "SCRIPTED",
    "riskLevel": "MEDIUM",
    "reason": "Risk level: MEDIUM | Selected actor: HYBRID | Actor confidence: 85%"
  }
}
```

## Audit & Compliance Features

### Structured Decision Logging

```typescript
// Every decision creates audit event
const auditEvent = {
  eventId: uuid(),
  tenantId: context.tenantId,
  opportunityId: context.opportunityId,
  decisionContext: context, // Full input context
  decisionResult: result, // Complete decision output
  enforcementMode: 'monitor_only',
  enforced: result.allowed, // Whether decision was enforced
  correlationId: context.correlationId,
  timestamp: new Date(),
};
```

### Decision Chain Traceability

1. **Playbook Engine** → ExecutionCommand
2. **Decision Engine** → DecisionResult (enriched command)
3. **GHL Adapter** → Execution with constraints
4. **Audit System** → Complete decision audit trail

## Success Criteria Met

✅ **Authoritative Decisions** - Decision Engine is the only component that decides execution parameters
✅ **Risk-Based Safety** - AI blocked for high-risk, humans required for critical situations
✅ **Voice Safety Controls** - Conversational AI blocked for dangerous scenarios
✅ **Fail-Safe Defaults** - Human-only fallback on decision engine errors
✅ **Immutable Results** - Decision outputs cannot be modified after creation
✅ **Enterprise Audit** - Every decision logged with full context and reasoning
✅ **Comprehensive Testing** - Unit tests cover all risk levels and decision scenarios
✅ **No External Logic** - All decision logic contained within NeuronX boundaries

## Conclusion

WI-029 transforms NeuronX from a "sales automation platform" into a **production operating system** with enterprise-grade decision intelligence. The Decision Engine ensures:

- **AI operates safely** within appropriate risk boundaries
- **Humans are deployed efficiently** for high-value, complex situations
- **Voice interactions are controlled** to prevent customer harm
- **Every decision is auditable** for compliance and improvement
- **The system scales safely** as automation increases

This is the executive layer that makes "10th-standard operators perform like top reps" economically viable. NeuronX now has the brain of a sales factory.

**Result:** Authoritative, auditable, enterprise-safe decision orchestration that scales human intelligence through AI while maintaining safety and compliance.
