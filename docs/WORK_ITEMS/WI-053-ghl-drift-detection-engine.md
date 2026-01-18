# WI-053: GHL Drift Detection Engine

## Objective

Implement a deterministic, explainable drift detection engine that compares GHL configuration snapshots to identify meaningful changes, classify them by impact, and enable proactive configuration management without compromising the read-only boundary.

## Scope

### In Scope

- Compare any two immutable GHL snapshots of the same type
- Detect ADDED, REMOVED, MODIFIED changes with raw before/after values
- Classify changes by category (config, capability, structural, cosmetic)
- Assign severity levels (low, medium, high, critical) based on impact
- Generate structured DriftEvent records with full audit trail
- Scheduled and manual drift detection triggers
- Comprehensive change filtering and summarization

### Out of Scope

- Drift remediation or auto-fixing
- Alert system integration (future WI)
- Drift visualization UI
- Historical trend analysis
- Cross-tenant drift correlation

## Implementation Details

### Drift Detection Architecture

The system provides deterministic comparison of GHL configuration snapshots:

```typescript
interface DriftDetectionResult {
  driftId: string;
  tenantId: string;
  ghlAccountId: string;
  snapshotType: SnapshotType;
  beforeSnapshotId: string;
  afterSnapshotId: string;
  detectedAt: Date;
  changes: DriftChange[];
  summary: {
    totalChanges: number;
    changesByType: Record<DriftChangeType, number>;
    changesByCategory: Record<DriftCategory, number>;
    maxSeverity: DriftSeverity;
    hasCriticalChanges: boolean;
  };
  metadata: {
    beforeCapturedAt: Date;
    afterCapturedAt: Date;
    timeSpanMs: number;
    correlationId: string;
  };
}
```

### Change Detection Types

Each drift change captures complete context for analysis:

```typescript
enum DriftChangeType {
  ADDED = 'ADDED', // New entities (locations, workflows, etc.)
  REMOVED = 'REMOVED', // Deleted entities
  MODIFIED = 'MODIFIED', // Changed entity properties
}

enum DriftCategory {
  CONFIG_DRIFT = 'CONFIG_DRIFT', // Pipeline stages, workflow settings
  CAPABILITY_DRIFT = 'CAPABILITY_DRIFT', // AI workers, messaging features
  STRUCTURAL_DRIFT = 'STRUCTURAL_DRIFT', // Deleted entities, renamed items
  COSMETIC_DRIFT = 'COSMETIC_DRIFT', // Labels, descriptions, non-functional
}

enum DriftSeverity {
  LOW = 'LOW', // Cosmetic changes, no functional impact
  MEDIUM = 'MEDIUM', // Operational changes, minor impact
  HIGH = 'HIGH', // Execution-impacting changes
  CRITICAL = 'CRITICAL', // Policy/capability violations
}
```

### Individual Change Structure

```typescript
interface DriftChange {
  changeType: DriftChangeType;
  entityId: string;
  entityType: string;
  diffPath: string; // JSON path to changed field
  beforeValue?: any; // Original value
  afterValue?: any; // New value
  category: DriftCategory;
  severity: DriftSeverity;
  description: string; // Human-readable explanation
  metadata?: Record<string, any>; // Additional context
}
```

### Drift Detection Engine

The core engine orchestrates comparison and classification:

```typescript
class GhlDriftDetectionService {
  async detectDrift(
    request: DriftDetectionRequest
  ): Promise<DriftDetectionResult> {
    // 1. Retrieve snapshots for comparison
    const { beforeSnapshot, afterSnapshot } =
      await getSnapshotsForComparison(request);

    // 2. Run appropriate detector for snapshot type
    const changes = await detector.detectDrift(
      beforeSnapshot,
      afterSnapshot,
      context
    );

    // 3. Classify and filter changes
    const classifiedChanges = classifyAndFilterChanges(changes);

    // 4. Create structured result
    const result = createDriftResult(request, classifiedChanges);

    // 5. Store result immutably
    await storeResult(result);

    // 6. Audit the detection run
    await auditDriftDetection(result);

    return result;
  }
}
```

### Detector Implementations

Specialized detectors for each snapshot type:

- **LocationDriftDetector**: Basic entity comparison
- **PipelineDriftDetector**: Pipeline + nested stage comparison
- **WorkflowDriftDetector**: Workflow + action sequence comparison
- **CalendarDriftDetector**: Calendar + appointment type + working hours comparison
- **AiWorkerDriftDetector**: AI worker + capability + limit comparison

### Classification Rules

Deterministic rules map changes to categories and severities:

#### Category Classification

- **CONFIG_DRIFT**: Pipeline stages, workflow triggers, calendar settings
- **CAPABILITY_DRIFT**: AI worker capabilities, messaging features, model changes
- **STRUCTURAL_DRIFT**: Entity deletions, renamed items, integration removals
- **COSMETIC_DRIFT**: Labels, descriptions, non-functional metadata

#### Severity Classification

- **LOW**: Cosmetic changes, description updates, label changes
- **MEDIUM**: Operational changes, new entities, minor configuration updates
- **HIGH**: Execution-impacting changes, working hour modifications, limit increases
- **CRITICAL**: Capability removals, AI model downgrades, structural deletions

### Trigger Mechanisms

#### Scheduled Triggers

- **Daily Comprehensive**: `@Cron(EVERY_DAY_AT_3AM)` - Full drift analysis after snapshots
- **Hourly Critical**: `@Cron(EVERY_HOUR)` - Pipelines, workflows, AI workers only
- **Weekly Analysis**: `@Cron('0 4 * * 0')` - Pattern analysis and trend detection

#### Manual Triggers

API-driven drift detection with full control:

```typescript
POST /api/drift/detect
{
  "tenantId": "tenant_123",
  "ghlAccountId": "ghl_acc_456",
  "snapshotTypes": ["pipelines", "workflows"],
  "beforeSnapshotId": "snapshot_001",  // Optional
  "afterSnapshotId": "snapshot_002",   // Optional
  "reason": "Post-deployment validation"
}
```

### Storage Schema

Drift results stored immutably for audit and analysis:

```sql
-- GHL Drift Results Table
CREATE TABLE ghl_drift (
  driftId TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  ghlAccountId TEXT NOT NULL,
  snapshotType TEXT NOT NULL,
  beforeSnapshotId TEXT NOT NULL,
  afterSnapshotId TEXT NOT NULL,
  detectedAt TIMESTAMP NOT NULL,
  changes JSONB NOT NULL,
  summary JSONB NOT NULL,
  beforeCapturedAt TIMESTAMP NOT NULL,
  afterCapturedAt TIMESTAMP NOT NULL,
  timeSpanMs BIGINT NOT NULL,
  correlationId TEXT NOT NULL,
  INDEX idx_tenant_type_detected (tenantId, snapshotType, detectedAt DESC),
  INDEX idx_tenant_account (tenantId, ghlAccountId),
  INDEX idx_correlation (correlationId)
);
```

### Safety Guarantees

- **Read-Only**: Never modifies snapshots or GHL data
- **Deterministic**: Same inputs produce identical results
- **Isolated**: Failures in one detection don't affect others
- **Auditable**: Every detection run is logged with correlation
- **Filtered**: Low-impact changes are filtered out by default
- **Bounded**: Performance limits prevent resource exhaustion

### Integration Points

- **Snapshot Service**: Retrieves snapshots for comparison
- **Storage Service**: Persists drift results immutably
- **Audit System**: Logs all detection activities
- **Scheduler**: Automated cron-based execution
- **API**: Manual trigger endpoints

## Acceptance Criteria

### Functional Requirements

- [x] All 5 snapshot types have specialized drift detectors
- [x] Changes detected include ADDED, REMOVED, MODIFIED with full context
- [x] Classification rules produce deterministic categories and severities
- [x] Scheduled triggers run automatically without intervention
- [x] Manual triggers work with proper request tracking
- [x] Drift results stored immutably with complete audit trail
- [x] Low-severity changes filtered out by default
- [x] Performance bounded with configurable limits

### Quality Requirements

- [x] All tests pass including regression tests
- [x] No linting errors or type violations
- [x] Comprehensive error handling and logging
- [x] Deterministic output for same inputs
- [x] Audit events generated for all operations
- [x] Schema validation prevents invalid results

### Enterprise Requirements

- [x] Immutable results - no updates or deletions possible
- [x] Complete audit trail for compliance
- [x] Correlation IDs for request tracing
- [x] Configurable severity filtering
- [x] Graceful degradation on failures
- [x] Performance monitoring and alerting

## Testing Strategy

### Unit Tests

- Drift detector logic for each snapshot type
- Classification engine rules and edge cases
- Storage operations and data integrity
- Trigger logic and scheduling validation

### Integration Tests

- End-to-end drift detection workflow
- Cross-snapshot type consistency
- Storage and retrieval operations
- Trigger execution in test environment

### Classification Tests

- Category assignment accuracy for various change types
- Severity level appropriateness
- Edge cases and boundary conditions
- Consistency across different snapshot types

## Risk Mitigation

- **Non-Determinism**: Strict comparison algorithms with no randomness
- **Performance Issues**: Bounded execution with configurable timeouts
- **Data Corruption**: Checksum validation on stored snapshots
- **False Positives**: Conservative change detection with noise filtering
- **Storage Growth**: Immutable design allows future cleanup policies
- **API Limits**: Respectful scheduling avoids peak-hour conflicts

## Success Metrics

- **Detection Accuracy**: >99.9% correct change identification
- **Classification Consistency**: >98% agreement on category/severity assignments
- **Performance**: <5 seconds for typical drift detection runs
- **Completeness**: 100% coverage of supported snapshot types
- **Reliability**: >99.5% successful detection runs

## Future Extensions

This foundation enables:

- **WI-054**: Drift impact correlation with business metrics
- **Alert System**: Automated notifications for critical drift
- **Trend Analysis**: Drift patterns over time
- **Remediation**: Guided configuration corrections
- **Visualization**: Drift change timelines and heatmaps
- **Predictive**: Drift likelihood based on historical patterns
