/**
 * Prometheus Metrics Registry - WI-024: Observability & Metrics Foundation
 *
 * Centralized metrics collection for all NeuronX subsystems.
 * Tenant-safe: no tenantId/correlationId labels to avoid cardinality explosion.
 */

import {
  register,
  collectDefaultMetrics,
  Gauge,
  Counter,
  Histogram,
} from 'prom-client';

// ============================================================================
// METRICS REGISTRY SETUP
// ============================================================================

// Enable default Node.js metrics
collectDefaultMetrics({ prefix: 'neuronx_' });

// Custom registry for application metrics
export const metricsRegistry = register;

// ============================================================================
// OUTBOX METRICS (WI-014)
// ============================================================================

export const outboxMetrics = {
  // Backlog gauges (updated periodically)
  pendingTotal: new Gauge({
    name: 'neuronx_outbox_pending_total',
    help: 'Total number of pending outbox events',
  }),

  processingTotal: new Gauge({
    name: 'neuronx_outbox_processing_total',
    help: 'Total number of outbox events currently being processed',
  }),

  deadLetterTotal: new Gauge({
    name: 'neuronx_outbox_dead_letter_total',
    help: 'Total number of outbox events in dead letter queue',
  }),

  // Counters for operations
  publishSuccessTotal: new Counter({
    name: 'neuronx_outbox_publish_success_total',
    help: 'Total number of successful outbox event publications',
  }),

  publishFailTotal: new Counter({
    name: 'neuronx_outbox_publish_fail_total',
    help: 'Total number of failed outbox event publications',
  }),

  // Histogram for operation duration
  dispatchDurationMs: new Histogram({
    name: 'neuronx_outbox_dispatch_duration_ms',
    help: 'Duration of outbox event dispatch operations',
    buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000],
  }),
};

// ============================================================================
// WEBHOOK METRICS (WI-018/020)
// ============================================================================

export const webhookMetrics = {
  // Backlog gauges
  pendingTotal: new Gauge({
    name: 'neuronx_webhook_pending_total',
    help: 'Total number of pending webhook deliveries',
  }),

  deadLetterTotal: new Gauge({
    name: 'neuronx_webhook_dead_letter_total',
    help: 'Total number of webhook deliveries in dead letter queue',
  }),

  // Counters for delivery operations
  deliverySuccessTotal: new Counter({
    name: 'neuronx_webhook_delivery_success_total',
    help: 'Total number of successful webhook deliveries',
  }),

  deliveryFailTotal: new Counter({
    name: 'neuronx_webhook_delivery_fail_total',
    help: 'Total number of failed webhook deliveries',
  }),

  // Histogram for delivery duration
  deliveryDurationMs: new Histogram({
    name: 'neuronx_webhook_delivery_duration_ms',
    help: 'Duration of webhook delivery operations',
    buckets: [100, 250, 500, 1000, 2500, 5000, 10000, 30000],
  }),
};

// ============================================================================
// SLA METRICS (WI-017)
// ============================================================================

export const slaMetrics = {
  // Backlog gauge
  dueTotal: new Gauge({
    name: 'neuronx_sla_due_total',
    help: 'Total number of SLA timers currently due for processing',
  }),

  // Counters for escalation operations
  escalationsSuccessTotal: new Counter({
    name: 'neuronx_sla_escalations_success_total',
    help: 'Total number of successful SLA escalations',
  }),

  escalationsFailTotal: new Counter({
    name: 'neuronx_sla_escalations_fail_total',
    help: 'Total number of failed SLA escalations',
  }),
};

// ============================================================================
// VOICE METRICS (WI-013)
// ============================================================================

export const voiceMetrics = {
  // Backlog gauge
  failedRetryableTotal: new Gauge({
    name: 'neuronx_voice_failed_retryable_total',
    help: 'Total number of failed voice attempts that are retryable',
  }),

  // Counter for retry operations
  retryAttemptTotal: new Counter({
    name: 'neuronx_voice_retry_attempt_total',
    help: 'Total number of voice retry attempts',
  }),
};

// ============================================================================
// AUTHORIZATION METRICS (WI-022)
// ============================================================================

export const authzMetrics = {
  // Counters for authentication results
  permissionDeniedTotal: new Counter({
    name: 'neuronx_auth_permission_denied_total',
    help: 'Total number of permission denied incidents',
  }),

  invalidApiKeyTotal: new Counter({
    name: 'neuronx_auth_invalid_api_key_total',
    help: 'Total number of invalid API key authentication attempts',
  }),

  successTotal: new Counter({
    name: 'neuronx_auth_success_total',
    help: 'Total number of successful authentications',
  }),
};

// ============================================================================
// SECRETS METRICS (WI-019)
// ============================================================================

export const secretsMetrics = {
  // Counters for secret operations
  getSuccessTotal: new Counter({
    name: 'neuronx_secrets_get_success_total',
    help: 'Total number of successful secret retrievals',
  }),

  getFailTotal: new Counter({
    name: 'neuronx_secrets_get_fail_total',
    help: 'Total number of failed secret retrievals',
  }),

  rotateTotal: new Counter({
    name: 'neuronx_secrets_rotate_total',
    help: 'Total number of secret rotations',
  }),
};

// ============================================================================
// ARTIFACTS/STORAGE METRICS (WI-021)
// ============================================================================

export const artifactsMetrics = {
  // Counters for artifact operations
  uploadUrlTotal: new Counter({
    name: 'neuronx_artifacts_upload_url_total',
    help: 'Total number of pre-signed upload URLs generated',
  }),

  downloadUrlTotal: new Counter({
    name: 'neuronx_artifacts_download_url_total',
    help: 'Total number of pre-signed download URLs generated',
  }),

  storageDeleteSuccessTotal: new Counter({
    name: 'neuronx_storage_delete_success_total',
    help: 'Total number of successful storage object deletions',
  }),

  storageDeleteFailTotal: new Counter({
    name: 'neuronx_storage_delete_fail_total',
    help: 'Total number of failed storage object deletions',
  }),
};

// ============================================================================
// CLEANUP METRICS (WI-023)
// ============================================================================

// Enum for allowed table names (low cardinality)
export enum CleanupTableName {
  OUTBOX_EVENTS = 'outbox_events',
  WEBHOOK_DELIVERIES = 'webhook_deliveries',
  WEBHOOK_ATTEMPTS = 'webhook_attempts',
  AUDIT_LOGS = 'audit_logs',
  ARTIFACT_RECORDS = 'artifact_records',
  USAGE_EVENTS = 'usage_events',
  USAGE_AGGREGATES = 'usage_aggregates',
}

export const cleanupMetrics = {
  // Counter for cleanup runs
  runTotal: new Counter({
    name: 'neuronx_cleanup_run_total',
    help: 'Total number of cleanup runs executed',
  }),

  // Counter for lock acquisition failures
  lockSkippedTotal: new Counter({
    name: 'neuronx_cleanup_lock_skipped_total',
    help: 'Total number of cleanup runs skipped due to lock acquisition failure',
  }),

  // Counter for deleted rows (by table)
  deletedRowsTotal: new Counter({
    name: 'neuronx_cleanup_deleted_rows_total',
    help: 'Total number of rows deleted by cleanup operations',
    labelNames: ['table_name'],
  }),

  // Histogram for cleanup duration
  durationMs: new Histogram({
    name: 'neuronx_cleanup_duration_ms',
    help: 'Duration of cleanup run operations',
    buckets: [1000, 5000, 10000, 30000, 60000, 120000, 300000], // 1s to 5min
  }),

  // Counter for cleanup errors (by table)
  errorsTotal: new Counter({
    name: 'neuronx_cleanup_errors_total',
    help: 'Total number of cleanup operation errors',
    labelNames: ['table_name'],
  }),
};

// ============================================================================
// METRICS COLLECTOR SERVICE
// ============================================================================

/**
 * Service to collect periodic metrics (backlog gauges)
 */
export class MetricsCollector {
  constructor(
    private readonly prisma: any // PrismaClient
  ) {}

  /**
   * Collect backlog metrics (run every 30 seconds)
   */
  async collectBacklogMetrics(): Promise<void> {
    try {
      // Outbox metrics
      const outboxCounts = await this.prisma.outboxEvent.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      outboxMetrics.pendingTotal.set(
        outboxCounts.find((c: any) => c.status === 'PENDING')?._count?.id || 0
      );
      outboxMetrics.processingTotal.set(
        outboxCounts.find((c: any) => c.status === 'PROCESSING')?._count?.id ||
          0
      );
      outboxMetrics.deadLetterTotal.set(
        outboxCounts.find((c: any) => c.status === 'DEAD_LETTER')?._count?.id ||
          0
      );

      // Webhook metrics
      const webhookCounts = await this.prisma.webhookDelivery.groupBy({
        by: ['status'],
        _count: { id: true },
      });

      webhookMetrics.pendingTotal.set(
        webhookCounts.find((c: any) => c.status === 'PENDING')?._count?.id || 0
      );
      webhookMetrics.deadLetterTotal.set(
        webhookCounts.find((c: any) => c.status === 'DEAD_LETTER')?._count
          ?.id || 0
      );

      // SLA metrics
      const dueSlaCount = await this.prisma.slaTimer.count({
        where: {
          status: 'ACTIVE',
          dueAt: { lte: new Date() },
        },
      });
      slaMetrics.dueTotal.set(dueSlaCount);

      // Voice metrics
      const failedRetryableCount = await this.prisma.voiceAttempt.count({
        where: {
          status: 'FAILED',
          attempts: { lt: 3 }, // Assuming maxRetries = 3
        },
      });
      voiceMetrics.failedRetryableTotal.set(failedRetryableCount);
    } catch (error: any) {
      // Log error but don't throw - metrics collection should never break business logic
      console.error('Failed to collect backlog metrics:', error.message);
    }
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get Prometheus metrics in text format
 */
export function getMetricsText(): Promise<string> {
  return register.metrics();
}

/**
 * Validate table name for cleanup metrics
 */
export function validateCleanupTableName(tableName: string): CleanupTableName {
  const validTableNames = Object.values(CleanupTableName);
  if (!validTableNames.includes(tableName as CleanupTableName)) {
    throw new Error(`Invalid cleanup table name: ${tableName}`);
  }
  return tableName as CleanupTableName;
}

/**
 * Reset all metrics (for testing)
 */
export function resetAllMetrics(): void {
  // Reset counters and histograms
  register.resetMetrics();
  // Re-enable default metrics
  collectDefaultMetrics({ prefix: 'neuronx_' });
}
