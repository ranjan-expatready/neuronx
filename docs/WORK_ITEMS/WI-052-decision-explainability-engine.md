# WI-052: Decision Explainability Engine

## Objective

Implement a comprehensive Decision Explainability Engine that produces structured, machine-readable explanations for every NeuronX decision, enabling auditability, compliance, and trust by making the "why" behind decisions transparent and deterministic.

## Scope

### In Scope

- Create structured DecisionExplanation format with complete factor attribution
- Implement deterministic explanation generation from decision context
- Build factor extractors for policies, authority, billing, and drift
- Create immutable explanation storage with full audit trail
- Develop comprehensive testing including determinism validation
- Ensure read-only operation - never modifies existing state

### Out of Scope

- Natural language explanation generation
- UI components for explanation display
- Explanation summarization or simplification
- Customer-facing explanation formats
- Real-time explanation streaming

## Implementation Details

### Decision Explanation Structure

The core output is a machine-readable explanation structure:

```typescript
interface DecisionExplanation {
  explanationId: string; // Unique identifier
  decisionId: string; // Links to original decision
  timestamp: Date; // When explanation was generated
  tenantId: string; // Tenant isolation
  opportunityId: string; // Opportunity context

  decisionSummary: {
    // What happened
    actionTaken: string;
    channelSelected: string;
    actorType: 'AI' | 'HUMAN' | 'HYBRID';
    executionAllowed: boolean;
    voiceMode?: 'SCRIPTED' | 'CONVERSATIONAL' | 'HUMAN_ONLY';
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  };

  policyFactors: PolicyFactor[]; // Which policies applied
  authorityFactors: AuthorityFactor[]; // Who had authority
  billingFactors: BillingFactor[]; // Billing constraints
  driftFactors: DriftFactor[]; // Configuration drift impact
  constraints: Constraint[]; // Additional constraints

  finalJustification: {
    // Why the final outcome
    blockingReason?: string;
    overrideReason?: string;
    escalationReason?: string;
    finalOutcome: 'allowed' | 'blocked' | 'escalated';
  };

  correlationIds: {
    // Request tracing
    decision: string;
    execution?: string;
    audit: string;
    drift?: string;
  };

  metadata: {
    // Processing metadata
    engineVersion: string;
    processingTimeMs: number;
    dataCompleteness: 'complete' | 'partial' | 'incomplete';
    missingDataReasons?: string[];
  };
}
```

### Factor Attribution Categories

#### Policy Factors

Attribution to specific policy rules and versions:

```typescript
interface PolicyFactor {
  policyType: 'decision' | 'channel_routing' | 'billing' | 'capability';
  policyVersion: string;
  ruleEvaluated: string;
  threshold?: any;
  actualValue?: any;
  result: 'allowed' | 'denied' | 'limited';
  reason: string;
}
```

#### Authority Factors

Organizational authority and capability checks:

```typescript
interface AuthorityFactor {
  authorityType: 'org_scope' | 'capability' | 'approval_required';
  scope: string;
  requirement: string;
  satisfied: boolean;
  reason?: string;
}
```

#### Billing Factors

Plan and quota enforcement details:

```typescript
interface BillingFactor {
  planTier: string;
  billingStatus: 'ACTIVE' | 'GRACE' | 'BLOCKED';
  quotaChecked: string;
  remaining?: number;
  allowed: boolean;
  reason: string;
}
```

#### Drift Factors

Configuration changes that affected the decision:

```typescript
interface DriftFactor {
  driftId: string;
  driftType: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affectedComponent: string;
  impactOnDecision: string;
  driftTimestamp: Date;
}
```

### Explanation Generation Flow

#### 1. Factor Extraction

```typescript
const factors = await factorExtractor.extractFactors(request);
// Extracts from: DecisionResult, policies, billing, authority, drift
```

#### 2. Explanation Building

```typescript
const explanation = await builder.buildExplanation(request, factors);
// Builds structured explanation with all factors attributed
```

#### 3. Immutable Storage

```typescript
await storage.store(explanation);
// Stores permanently for audit and compliance
```

### Deterministic Generation

Critical requirement: identical inputs produce identical explanations.

**Testing Approach:**

- Multiple runs with same inputs produce structurally identical explanations
- Explanation IDs and timestamps may differ (expected)
- All factor attribution remains consistent
- Processing metadata may vary slightly but core content is identical

### Storage Schema

Explanations stored immutably for enterprise audit requirements:

```sql
-- Decision Explanations Table
CREATE TABLE decision_explanation (
  explanationId TEXT PRIMARY KEY,
  decisionId TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  tenantId TEXT NOT NULL,
  opportunityId TEXT NOT NULL,

  decisionSummary JSONB NOT NULL,
  policyFactors JSONB NOT NULL,
  authorityFactors JSONB NOT NULL,
  billingFactors JSONB NOT NULL,
  driftFactors JSONB NOT NULL,
  constraints JSONB NOT NULL,
  finalJustification JSONB NOT NULL,
  correlationIds JSONB NOT NULL,

  engineVersion TEXT NOT NULL,
  processingTimeMs INTEGER NOT NULL,
  dataCompleteness TEXT NOT NULL,
  missingDataReasons JSONB,

  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  INDEX idx_decision (decisionId),
  INDEX idx_tenant_timestamp (tenantId, timestamp DESC),
  INDEX idx_correlation (correlationIds)
);
```

### Safety Guarantees

- **Read-Only**: Never modifies decisions, policies, or any existing state
- **Deterministic**: Same inputs → identical explanations (except IDs/timestamps)
- **Fail-Safe**: Missing data explicitly marked, never assumed
- **Isolated**: Failures in explanation don't affect decision execution
- **Auditable**: Every explanation generation logged with full context

### Integration Points

- **Decision Engine**: Read-only access to DecisionResult and context
- **Policy Systems**: Read-only access to current policy snapshots
- **Billing Service**: Read-only access to billing state and quotas
- **Org Authority**: Read-only access to user roles and capabilities
- **Drift Service**: Read-only access to relevant drift events
- **Audit System**: Writes explanation generation events

## Acceptance Criteria

### Functional Requirements

- [x] Structured explanations generated for any decision ID
- [x] All factor types properly attributed (policy, authority, billing, drift)
- [x] Deterministic output for identical inputs
- [x] Immutable storage with complete audit trail
- [x] Missing data explicitly handled without assumptions
- [x] Final justification correctly derived from all factors
- [x] Correlation IDs properly maintained across systems

### Quality Requirements

- [x] All tests pass including determinism validation
- [x] No linting errors or type violations
- [x] Comprehensive error handling and logging
- [x] Schema validation prevents invalid explanations
- [x] Performance bounded with configurable timeouts
- [x] Memory usage controlled for large factor sets

### Enterprise Requirements

- [x] Complete audit trail for regulator compliance
- [x] Tenant isolation enforced at all levels
- [x] Correlation IDs enable end-to-end tracing
- [x] Processing metadata enables performance monitoring
- [x] Data completeness assessment for trust evaluation
- [x] Immutable storage prevents tampering

## Testing Strategy

### Determinism Tests

- **Objective**: Verify identical inputs produce identical explanations
- **Approach**: Multiple execution runs with same request
- **Validation**: Core explanation content identical, only IDs/timestamps differ
- **Coverage**: All factor types and edge cases

### Attribution Tests

- **Policy Attribution**: Every decision rule properly referenced with version
- **Authority Attribution**: User capabilities and org scope correctly reflected
- **Billing Attribution**: Plan tiers and quota checks accurately represented
- **Drift Attribution**: Relevant configuration changes properly included

### Negative Tests

- **Missing Data**: Graceful handling with explicit "unknown" markers
- **Partial Data**: Correct completeness assessment and missing data reporting
- **Error Conditions**: Proper error propagation without system failure
- **Invalid Inputs**: Schema validation prevents malformed explanations

## Risk Mitigation

- **Non-Determinism**: Rigorous testing ensures consistent output
- **Performance Impact**: Bounded processing with monitoring
- **Storage Growth**: Immutable design with future cleanup policies
- **Missing Context**: Explicit missing data handling
- **Audit Gaps**: Comprehensive logging of all operations
- **Data Corruption**: Schema validation and integrity checks

## Success Metrics

- **Determinism Score**: 100% identical outputs for identical inputs
- **Factor Completeness**: >95% of decisions have complete factor attribution
- **Generation Success Rate**: >99.5% successful explanation generation
- **Storage Reliability**: 100% successful explanation persistence
- **Query Performance**: <50ms for explanation retrieval by decision ID
- **Audit Coverage**: 100% of explanation operations logged

## Future Extensions

This foundation enables:

- **Regulatory Reporting**: Structured explanations for compliance audits
- **Customer Transparency**: Filtered explanations for end-user understanding
- **Analytics**: Decision pattern analysis and optimization insights
- **Debugging**: Historical decision reconstruction for support
- **Machine Learning**: Training data for decision quality improvement
- **Alerting**: Automated detection of unusual decision patterns
