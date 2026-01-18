# WI-049: GHL Snapshot Ingestion (Read-Only)

## Objective

Implement a comprehensive read-only snapshot ingestion system for GHL configuration data to enable drift detection, explainability, and enterprise trust without compromising the strict read-only boundary.

## Scope

### In Scope

- Create immutable snapshots of GHL configuration (locations, pipelines, workflows, calendars, AI workers)
- Implement scheduled and manual snapshot triggers
- Design storage schema for versioned, auditable snapshots
- Add observability and audit logging for all snapshot operations
- Ensure STRICTLY read-only - no mutations of GHL data
- Forward compatibility for unknown GHL fields
- Partial failure handling without blocking other snapshots

### Out of Scope

- Diffing or comparison logic (future WI)
- UI for snapshot viewing
- Snapshot cleanup or retention policies
- Integration with drift detection alerts
- Performance optimization beyond basic batching

## Implementation Details

### Snapshot Types & Data

The system captures comprehensive GHL configuration snapshots:

```typescript
enum SnapshotType {
  LOCATIONS = 'locations', // Business locations and settings
  PIPELINES = 'pipelines', // Sales pipelines and stages
  WORKFLOWS = 'workflows', // Automation workflows and triggers
  CALENDARS = 'calendars', // Calendar configurations and availability
  AI_WORKERS = 'ai_workers', // AI worker definitions and settings
}
```

### Storage Schema

Snapshots are stored immutably with full audit trail:

```sql
-- GHL Snapshot Table
CREATE TABLE ghl_snapshot (
  snapshotId TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  ghlAccountId TEXT NOT NULL,
  snapshotType TEXT NOT NULL,
  capturedAt TIMESTAMP NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  status TEXT NOT NULL, -- 'success', 'partial_failure', 'failed'
  recordCount INTEGER NOT NULL DEFAULT 0,
  checksum TEXT NOT NULL,
  payload JSONB NOT NULL, -- Raw GHL data, preserved as-is
  createdAt TIMESTAMP NOT NULL DEFAULT NOW(),
  createdBy TEXT NOT NULL DEFAULT 'system',
  source TEXT NOT NULL, -- 'scheduled', 'manual', 'api'
  correlationId TEXT NOT NULL,
  INDEX idx_tenant_type_captured (tenantId, snapshotType, capturedAt DESC),
  INDEX idx_tenant_account (tenantId, ghlAccountId),
  INDEX idx_correlation (correlationId)
);
```

### Snapshot Structure

Each snapshot maintains complete fidelity to GHL data:

```typescript
interface GhlSnapshot {
  metadata: {
    snapshotId: string; // Unique identifier
    tenantId: string; // Tenant isolation
    ghlAccountId: string; // GHL account association
    snapshotType: SnapshotType;
    capturedAt: Date; // Exact capture timestamp
    version: string; // Schema version for compatibility
    status: 'success' | 'partial_failure' | 'failed';
    recordCount: number; // Entities captured
    checksum: string; // Data integrity verification
  };
  payload: {
    data: any[]; // Raw GHL entities, unchanged
    metadata: {
      totalCount?: number;
      hasMore?: boolean;
      nextCursor?: string;
      ghlApiVersion?: string;
      requestTimestamp: Date;
    };
  };
  audit: {
    createdAt: Date;
    createdBy: string; // 'system' for automated
    source: 'scheduled' | 'manual' | 'api';
    correlationId: string;
  };
}
```

### Ingestion Triggers

#### Scheduled Triggers

- **Daily Full Snapshot**: `@Cron(CronExpression.EVERY_DAY_AT_2AM)`
  - Comprehensive capture of all configuration types
  - Runs during low-traffic hours
  - Includes validation and consistency checks

- **Hourly Critical Updates**: `@Cron(CronExpression.EVERY_HOUR)`
  - Pipelines and workflows (most likely to change)
  - Lightweight, focused updates

- **Weekly Validation**: `@Cron('0 3 * * 0')`
  - Full validation run with consistency checks
  - Ensures no silent configuration drift

#### Manual Triggers

API-driven snapshot requests with full control:

```typescript
POST /api/snapshots/trigger
{
  "tenantId": "tenant_123",
  "ghlAccountId": "ghl_acc_456",
  "snapshotTypes": ["pipelines", "workflows"], // Optional, defaults to all
  "priority": "high", // Affects processing priority
  "reason": "Pre-deployment validation"
}
```

Response includes request tracking:

```json
{
  "requestId": "manual_snapshot_1703123456789_abc123",
  "status": "accepted",
  "estimatedDuration": "30s"
}
```

### Failure Handling

Robust failure isolation ensures reliability:

- **Partial Failures**: One snapshot type failing doesn't block others
- **Rate Limiting**: Respects GHL API limits with automatic backoff
- **Timeout Protection**: Configurable timeouts prevent hanging
- **Retry Logic**: Automatic retries for transient failures
- **Audit Trail**: All failures logged with full context

### Observability & Audit

Complete visibility into snapshot operations:

#### Metrics

```typescript
// Prometheus-style metrics
ghl_snapshot_duration_ms{snapshot_type, tenant_id, success}
ghl_snapshot_records_total{snapshot_type, tenant_id}
ghl_snapshot_errors_total{snapshot_type, tenant_id, error_type}
ghl_snapshot_api_calls_total{endpoint, status_code}
```

#### Audit Events

```json
{
  "eventType": "ghl_snapshot_full_run",
  "tenantId": "tenant_123",
  "ghlAccountId": "ghl_acc_456",
  "correlationId": "scheduled_daily_1703123456789",
  "timestamp": "2026-01-05T02:00:00Z",
  "success": true,
  "totalSnapshots": 5,
  "successfulSnapshots": 5,
  "totalRecords": 127,
  "durationMs": 45230,
  "source": "scheduled"
}
```

### Files Modified

- `packages/ghl-snapshots/src/snapshot-types.ts` (NEW)
- `packages/ghl-snapshots/src/ghl-snapshot.service.ts` (NEW)
- `packages/ghl-snapshots/src/storage/snapshot-storage.service.ts` (NEW)
- `packages/ghl-snapshots/src/ingestion/base-snapshot.ingestion.ts` (NEW)
- `packages/ghl-snapshots/src/ingestion/location-snapshot.ingestion.ts` (NEW)
- `packages/ghl-snapshots/src/ingestion/pipeline-snapshot.ingestion.ts` (NEW)
- `packages/ghl-snapshots/src/ingestion/workflow-snapshot.ingestion.ts` (NEW)
- `packages/ghl-snapshots/src/ingestion/calendar-snapshot.ingestion.ts` (NEW)
- `packages/ghl-snapshots/src/ingestion/ai-worker-snapshot.ingestion.ts` (NEW)
- `packages/ghl-snapshots/src/triggers/scheduled-snapshot.trigger.ts` (NEW)
- `packages/ghl-snapshots/src/triggers/manual-snapshot.trigger.ts` (NEW)
- `packages/ghl-snapshots/src/ghl-snapshot-service.factory.ts` (NEW)
- `packages/ghl-snapshots/package.json` (NEW)
- `packages/ghl-snapshots/tsconfig.json` (NEW)
- `packages/ghl-snapshots/src/index.ts` (NEW)

### Safety Guarantees

- **Read-Only**: No mutations of GHL data, ever
- **No Business Logic**: Snapshots are pure data capture
- **Forward Compatibility**: Unknown GHL fields preserved
- **Tenant Isolation**: Complete data isolation between tenants
- **Audit Trail**: Every snapshot operation is logged
- **Failure Isolation**: Partial failures don't compromise system

### Integration Points

- **Database**: Direct Prisma integration for storage
- **Scheduler**: NestJS cron jobs for automated snapshots
- **API**: Manual trigger endpoints for on-demand snapshots
- **Observability**: Metrics and audit events for monitoring

## Acceptance Criteria

### Functional Requirements

- [x] All 5 snapshot types implemented with full GHL data fidelity
- [x] Scheduled triggers run automatically without intervention
- [x] Manual triggers work with proper request tracking
- [x] Partial failures don't block other snapshot types
- [x] Unknown GHL fields are preserved for forward compatibility
- [x] All snapshots include integrity checksums
- [x] Tenant isolation enforced at storage level
- [x] Rate limiting and timeout protection implemented

### Quality Requirements

- [x] All tests pass including regression tests
- [x] No linting errors or type violations
- [x] Comprehensive error handling and logging
- [x] Audit events generated for all operations
- [x] Metrics available for observability
- [x] Schema validation prevents invalid snapshots

### Enterprise Requirements

- [x] Immutable snapshots - no updates or deletions
- [x] Complete audit trail for compliance
- [x] Correlation IDs for request tracing
- [x] Configurable timeouts and retry policies
- [x] Graceful degradation on failures
- [x] Performance monitoring and alerting

## Testing Strategy

### Unit Tests

- Snapshot ingestion for each type with mock GHL data
- Storage operations with various query patterns
- Trigger logic for scheduled and manual operations
- Error handling and failure scenarios
- Checksum calculation and integrity verification

### Integration Tests

- Full snapshot run with real database operations
- Scheduled trigger execution in test environment
- Manual trigger API workflow end-to-end
- Cross-tenant isolation verification
- Performance testing with large datasets

### Observability Tests

- Audit event generation and structure validation
- Metrics collection and aggregation
- Error logging and alerting verification
- Correlation ID propagation testing

## Risk Mitigation

- **Data Loss**: Checksums ensure integrity, retries handle transient failures
- **Performance Impact**: Scheduled during low-traffic hours, rate limiting prevents abuse
- **API Limits**: Respectful of GHL rate limits with backoff strategies
- **Storage Growth**: Immutable design allows for future cleanup policies
- **Forward Compatibility**: Raw data preservation handles GHL API changes

## Success Metrics

- **Snapshot Success Rate**: >99.5% for individual snapshot types
- **Full Run Completion**: >95% of scheduled runs complete successfully
- **Data Fidelity**: 100% preservation of GHL data structures
- **Performance**: <30 seconds for typical full snapshot runs
- **Audit Coverage**: 100% of snapshot operations logged

## Future Extensions

This foundation enables:

- **WI-053**: Drift detection by comparing snapshots over time
- **WI-052**: Explainability features using snapshot data
- **Analytics**: Configuration change patterns and trends
- **Compliance**: Point-in-time configuration reconstruction
- **Support**: Historical configuration debugging
