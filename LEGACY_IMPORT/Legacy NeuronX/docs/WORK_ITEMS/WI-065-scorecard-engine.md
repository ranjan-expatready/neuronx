# WI-065: Scorecard Engine & Analytics Integration

## Objective

Build a comprehensive scorecard engine that provides role-specific analytics dashboards using existing NeuronX authoritative sources. Ensure all metrics are deterministic, policy-driven, and provide complete audit trails for governance and compliance.

## Context

NeuronX currently has rich operational data across FSM events, decision explanations, drift detection, boundary violations, billing, voice orchestration, and readiness states. However, there is no unified way for different user roles (Operator/Manager/Executive) to understand system performance and make data-driven decisions.

This work item creates a policy-driven scorecard engine that surfaces the right intelligence to the right roles without duplicating GHL CRM UI or exposing raw data inappropriately.

## Scope

### In Scope

- **New Package**: `packages/scorecard-engine/` with complete metric calculation engine
- **Policy Configuration**: YAML-driven metric definitions, thresholds, and role mappings
- **API Endpoints**: Scorecard generation and drill-down endpoints in core-api
- **Role Surfaces**: OPERATOR, MANAGER, EXECUTIVE with appropriate metric subsets
- **Metric Categories**: Sales effectiveness, operational excellence, governance, revenue, readiness
- **Evidence Links**: Every metric includes source references and correlation IDs
- **Audit Integration**: All scorecard operations are fully auditable
- **Deterministic Calculations**: Same inputs produce identical scorecard results

### Out of Scope

- UI components (pure server-driven, existing UI will consume APIs)
- Real-time dashboards (computed on-demand with optional caching)
- Custom metric definitions (all metrics must be policy-approved)
- Data export functionality (drill-down provides structured access)
- Historical trend storage (trends calculated from current + previous periods)

## Implementation Details

### 1. Scorecard Engine Package Architecture

#### Core Components

```
packages/scorecard-engine/
├── src/
│   ├── types.ts              # TypeScript interfaces and schemas
│   ├── policy.ts             # YAML policy loader and validation
│   ├── resolver.ts           # Metric calculation engine
│   ├── index.ts              # Package exports
│   ├── __tests__/            # Unit tests with golden fixtures
│   └── __tests__/fixtures/   # Expected scorecard outputs
├── package.json
├── tsconfig.json
└── jest.config.js
```

#### Type System

```typescript
enum RoleSurface {
  OPERATOR = 'OPERATOR', // Front-line operations
  MANAGER = 'MANAGER', // Team management
  EXECUTIVE = 'EXECUTIVE', // Executive oversight
}

enum TimeRange {
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
}

enum PerformanceBand {
  GREEN = 'GREEN', // Good performance
  YELLOW = 'YELLOW', // Needs attention
  RED = 'RED', // Critical issues
}

interface ScorecardMetric {
  key: string;
  label: string;
  value: number;
  band: PerformanceBand;
  evidence: MetricEvidence;
  trend?: number;
}

interface Scorecard {
  tenantId: string;
  surface: RoleSurface;
  sections: ScorecardSection[];
  overallBand: PerformanceBand;
  correlationId: string;
}
```

### 2. Policy-Driven Configuration

#### YAML Policy Structure

```yaml
version: '1.0.0'
global:
  enabledSurfaces: ['OPERATOR', 'MANAGER', 'EXECUTIVE']
  defaultTimeRanges: ['7d', '30d', '90d']

metrics:
  salesEffectiveness:
    lead_to_contact_rate:
      enabled: true
      surfaces: ['OPERATOR', 'MANAGER', 'EXECUTIVE']
      source: 'fsm'
      thresholds:
        green: { min: 75, max: 100 }
        yellow: { min: 50, max: 74 }
        red: { min: 0, max: 49 }

sections:
  salesEffectiveness:
    metrics: ['lead_to_contact_rate', 'contact_to_qualified_rate', ...]

surfaces:
  OPERATOR:
    sections: ['salesEffectiveness', 'operationalExcellence']
    maxMetricsPerSection: 5
```

#### Policy Validation

- **Schema Validation**: Zod runtime validation of YAML structure
- **Cross-Reference Checks**: Ensures all metric/section/surface references are valid
- **Threshold Validation**: Confirms threshold ranges don't overlap
- **Fail-Fast Loading**: Invalid policy prevents service startup

### 3. Metric Calculation Engine

#### Resolver Architecture

```typescript
class ScorecardResolver {
  async resolveScorecard(query: ScorecardQuery): Promise<Scorecard> {
    // 1. Load policy for surface
    const sections = policyLoader.getSectionsForSurface(query.surface);

    // 2. Calculate metrics for each section
    const scorecardSections = await Promise.all(
      sections.map(section => this.calculateSectionMetrics(section, query))
    );

    // 3. Determine overall band (worst metric wins)
    const overallBand = this.calculateOverallBand(scorecardSections);

    // 4. Return deterministic result
    return {
      tenantId: query.tenantId,
      surface: query.surface,
      sections: scorecardSections,
      overallBand,
      correlationId: generateCorrelationId(),
      generatedAt: new Date(),
      policyVersion: policy.version,
    };
  }
}
```

#### Metric Categories & Calculations

##### Sales Effectiveness Metrics

- **lead_to_contact_rate**: `(contacts / total_leads) * 100`
- **contact_to_qualified_rate**: `(qualified / contacted) * 100`
- **qualified_to_booked_rate**: `(booked / qualified) * 100`
- **booked_to_consult_done_rate**: `(completed / booked) * 100`
- **no_show_rate**: `(no_shows / booked) * 100`
- **avg_time_in_new_state**: Average hours in NEW state

##### Operational Excellence Metrics

- **sla_breach_rate**: `(breached_opportunities / total_opportunities) * 100`
- **sla_at_risk_count**: Count of opportunities at risk
- **execution_success_rate**: `(successful_executions / total_executions) * 100`
- **retry_rate**: `(retries / total_executions) * 100`
- **manual_override_rate**: `(overrides / total_decisions) * 100`

##### Governance & Risk Metrics

- **blocked_actions_count**: Count of governance-blocked actions
- **high_risk_decisions_count**: Count of decisions with low confidence
- **drift_events_critical**: Count of critical drift events
- **boundary_violations_critical**: Count of critical boundary violations
- **voice_enum_compliance_rate**: `(compliant / total_voice_ops) * 100`
- **decisions_with_explanations_rate**: `(explained / total_decisions) * 100`

##### Revenue Integrity Metrics

- **billing_active_tenants_rate**: `(active / total_tenants) * 100`
- **quota_utilization_voice**: `(used_minutes / quota_minutes) * 100`
- **billing_sync_failures_count**: Count of sync failures
- **grace_period_tenants_count**: Count of tenants in grace period

##### Readiness Metrics

- **readiness_overall_green_rate**: `(green_tenants / total_tenants) * 100`
- **readiness_blocking_reasons_top**: Count of blocking reasons

### 4. API Endpoints

#### Scorecard Generation

```
GET /api/scorecards/:tenantId
Query Params:
  - surface: OPERATOR | MANAGER | EXECUTIVE
  - timeRange: 7d | 30d | 90d
  - teamId?: string (optional filter)
  - userId?: string (optional filter)
  - includeDetails?: boolean (include evidence)

Headers:
  - x-tenant-id: string (enforced by guard)
  - x-correlation-id?: string

Response:
{
  "success": true,
  "data": {
    "tenantId": "tenant-001",
    "surface": "OPERATOR",
    "sections": [...],
    "overallBand": "GREEN",
    "correlationId": "scorecard_..."
  }
}
```

#### Drill-Down Access

```
GET /api/scorecards/:tenantId/drilldown
Query Params:
  - metricKey: string (e.g., "lead_to_contact_rate")
  - timeRange: 7d | 30d | 90d
  - teamId?: string
  - userId?: string
  - page?: number (default: 1)
  - limit?: number (default: 50)

Response:
{
  "success": true,
  "data": {
    "metricKey": "lead_to_contact_rate",
    "records": [
      {
        "id": "opp_123",
        "type": "opportunity",
        "timestamp": "2026-01-01T10:00:00Z",
        "details": { "state": "CONTACT_ATTEMPTING", "value": 50000 }
      }
    ],
    "pagination": {
      "total": 85,
      "page": 1,
      "limit": 50
    }
  }
}
```

#### Metadata Endpoint

```
GET /api/scorecards/metadata

Response:
{
  "success": true,
  "data": {
    "availableSurfaces": ["OPERATOR", "MANAGER", "EXECUTIVE"],
    "availableTimeRanges": ["7d", "30d", "90d"],
    "policyVersion": "1.0.0"
  }
}
```

### 5. Evidence & Audit Integration

#### Metric Evidence Structure

```typescript
interface MetricEvidence {
  source:
    | 'fsm'
    | 'audit_log'
    | 'drift_events'
    | 'readiness'
    | 'billing'
    | 'decisions';
  queryParams: Record<string, any>; // Parameters used for calculation
  policyVersion: string; // Policy version that defined metric
  correlationIds: string[]; // Related correlation IDs
  recordCount: number; // Records contributing to metric
  timestamp: Date; // When evidence was gathered
}
```

#### Audit Event Integration

```typescript
// Scorecard generation audit
await auditService.logEvent(
  'scorecard_generated',
  {
    surface: scorecard.surface,
    timeRange: scorecard.timeRange,
    sectionCount: scorecard.sections.length,
    metricCount: totalMetrics,
    overallBand: scorecard.overallBand,
    policyVersion: scorecard.policyVersion,
  },
  'scorecard-service',
  scorecard.tenantId
);

// Drill-down access audit
await auditService.logEvent(
  'scorecard_drilldown_accessed',
  {
    metricKey: query.metricKey,
    recordCount: drilldown.records.length,
    page: query.page,
    limit: query.limit,
  },
  'scorecard-service',
  query.tenantId
);
```

### 6. Testing Strategy

#### Unit Tests

- **Policy Loading**: YAML validation, cross-reference checks, threshold validation
- **Metric Calculations**: Deterministic calculations for each metric type
- **Resolver Logic**: Surface filtering, section organization, band calculation
- **Evidence Generation**: Proper source attribution and correlation ID handling

#### Integration Tests

- **API Endpoints**: Full request/response cycles with authentication
- **Database Queries**: Realistic data scenarios and performance validation
- **Audit Integration**: Event persistence and query validation
- **Policy Changes**: Hot-reload capability and validation

#### Golden Fixtures

```json
// packages/scorecard-engine/src/__tests__/fixtures/golden-scorecard-operator-7d.json
{
  "tenantId": "test-tenant-001",
  "surface": "OPERATOR",
  "overallBand": "YELLOW",
  "sections": [
    {
      "key": "salesEffectiveness",
      "overallBand": "YELLOW",
      "metrics": [
        {
          "key": "lead_to_contact_rate",
          "value": 85.5,
          "band": "GREEN",
          "evidence": {
            /* complete evidence */
          }
        }
      ]
    }
  ]
}
```

#### Test Coverage Requirements

- **Policy Engine**: 95% coverage (critical for business rules)
- **Resolver Logic**: 90% coverage (metric calculations)
- **API Endpoints**: 85% coverage (integration points)
- **Evidence Generation**: 90% coverage (audit compliance)

## Acceptance Criteria

### Functional Requirements

- [x] **Policy-Driven**: All metrics, thresholds, and role mappings defined in YAML
- [x] **Deterministic Results**: Same inputs produce identical scorecards
- [x] **Role-Specific Surfaces**: OPERATOR/MANAGER/EXECUTIVE get appropriate metrics
- [x] **Evidence Links**: Every metric includes source references and drill-down capability
- [x] **Audit Integration**: All scorecard operations are fully auditable
- [x] **Multi-Tenant**: Strict tenant isolation with proper guards
- [x] **Performance**: Sub-second response times for scorecard generation

### Technical Requirements

- [x] **Type Safety**: Full TypeScript coverage with Zod validation
- [x] **Error Handling**: Graceful degradation with detailed error reporting
- [x] **Caching Strategy**: Optional caching with proper invalidation
- [x] **Query Optimization**: Bounded queries with pagination support
- [x] **Memory Efficiency**: Streaming results for large drill-down datasets

### Governance Requirements

- [x] **No UI Logic**: Pure server-driven, UI only displays API responses
- [x] **No GHL Duplication**: Intelligence only, no CRM UI replacement
- [x] **Correlation IDs**: All operations include traceable correlation IDs
- [x] **Immutable Audit**: Audit records cannot be modified or deleted
- [x] **Policy Versioning**: All metrics tagged with policy version used

## Testing Strategy

### Unit Testing

```typescript
describe('ScorecardResolver', () => {
  it('should calculate lead_to_contact_rate deterministically', () => {
    // Given specific database state
    // When resolver calculates metric
    // Then result matches golden fixture
  });

  it('should apply correct performance bands', () => {
    // Given metric value and policy thresholds
    // When band calculation runs
    // Then correct band is assigned
  });
});
```

### Integration Testing

```typescript
describe('Scorecard API', () => {
  it('should generate scorecard with proper authentication', () => {
    // Given authenticated request with tenant context
    // When GET /api/scorecards/:tenantId
    // Then returns valid scorecard with evidence
  });

  it('should enforce tenant isolation', () => {
    // Given request for different tenant
    // When accessing scorecard
    // Then forbidden response
  });
});
```

### Performance Testing

```typescript
describe('Scorecard Performance', () => {
  it('should generate scorecard within 500ms', () => {
    // Given realistic dataset
    // When generating scorecard
    // Then response time < 500ms
  });

  it('should handle drill-down pagination efficiently', () => {
    // Given large dataset
    // When requesting paginated drill-down
    // Then memory usage remains bounded
  });
});
```

## Risk Mitigation

### Performance Risks

- **Query Optimization**: All database queries include appropriate indexes and limits
- **Caching Strategy**: Optional Redis caching with TTL-based invalidation
- **Pagination**: Drill-down results paginated to prevent memory issues
- **Timeout Handling**: Database queries have reasonable timeouts

### Data Consistency Risks

- **Deterministic Calculations**: All metrics use fixed calculation formulas
- **Evidence Immutability**: Evidence references are calculated once and cached
- **Audit Trail**: All operations logged with full context for debugging
- **Policy Validation**: Policy changes require validation before deployment

### Security Risks

- **Tenant Isolation**: All queries include tenant_id filters
- **Input Validation**: All API inputs validated with strict schemas
- **Rate Limiting**: API endpoints protected with appropriate rate limits
- **Audit Monitoring**: Suspicious patterns detected via audit analysis

## Dependencies

### Runtime Dependencies

- `@neuronx/uat-harness` - For UAT environment detection
- `zod` - Runtime schema validation
- `js-yaml` - Policy file parsing
- `prisma` - Database access for metrics and audit

### Development Dependencies

- `jest` - Testing framework
- `@types/js-yaml` - TypeScript definitions
- Test fixtures and golden data sets

## Rollback Plan

### Immediate Rollback

1. **API Removal**: Remove scorecard routes from core-api module
2. **Package Removal**: Remove scorecard-engine package references
3. **Policy File**: Remove scorecard-policy.yaml
4. **Database Cleanup**: Remove scorecard-related audit events

### Gradual Rollback

1. **Feature Flag**: Add feature flag to disable scorecard generation
2. **API Deprecation**: Mark endpoints as deprecated with sunset date
3. **Data Migration**: Archive existing scorecard audit events
4. **UI Updates**: Update UI to handle disabled scorecard features

### Complete Removal

1. **Package Deletion**: Remove packages/scorecard-engine/ directory
2. **Module Removal**: Remove ScorecardModule from app.module.ts
3. **Audit Cleanup**: Remove scorecard audit events from database
4. **Documentation**: Remove WI-065 and related evidence

## Success Metrics

### Performance Metrics

- **Response Time**: < 500ms for scorecard generation
- **Throughput**: 100+ scorecards per minute
- **Cache Hit Rate**: > 80% for repeated requests
- **Memory Usage**: < 100MB per concurrent request

### Quality Metrics

- **Test Coverage**: > 90% for critical paths
- **Determinism**: 100% consistent results for same inputs
- **Audit Completeness**: 100% of operations logged
- **Error Rate**: < 1% of requests result in errors

### Business Metrics

- **User Adoption**: Scorecards viewed by > 80% of target users
- **Decision Impact**: Scorecard insights lead to measurable improvements
- **Data Accuracy**: < 0.1% variance between scorecard and source data
- **Compliance**: 100% audit trail coverage for regulatory requirements

## Future Enhancements

### Phase 2 Features

- **Real-Time Updates**: WebSocket-based live scorecard updates
- **Custom Dashboards**: User-configurable metric combinations
- **Predictive Analytics**: ML-based trend predictions and anomaly detection
- **Cross-Tenant Analytics**: Executive-level multi-tenant insights
- **Export Capabilities**: PDF/CSV export with compliance watermarking
- **Alert Integration**: Automated alerts based on scorecard thresholds

### Integration Opportunities

- **BI Tool Integration**: Direct connections to Tableau/PowerBI/Looker
- **Mobile App**: Native mobile scorecard access for executives
- **Slack Integration**: Daily scorecard summaries via Slack
- **Email Reports**: Scheduled scorecard emails with key insights
- **API Rate Limiting**: Advanced rate limiting based on usage patterns

This implementation provides a solid foundation for data-driven decision making while maintaining strict governance, performance, and security standards.
