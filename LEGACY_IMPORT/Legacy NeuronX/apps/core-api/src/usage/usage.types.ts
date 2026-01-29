/**
 * Usage Metering Types - REQ-019: Configuration as IP
 *
 * Types for tracking tenant-level usage across monetized domains.
 * Usage data enables entitlement enforcement and billing observation.
 */

import { SemanticVersion } from '../config/config.types';

/**
 * Usage metric categories
 * Defines the types of usage that can be tracked
 */
export type UsageMetric =
  // Lead processing metrics
  | 'leads.processed'
  | 'leads.qualified'
  | 'leads.routed'

  // Routing metrics
  | 'routing.decisions'
  | 'routing.capacity_used'
  | 'routing.teams_assigned'

  // SLA metrics
  | 'sla.timers.started'
  | 'sla.timers.violated'
  | 'sla.escalations.triggered'

  // Voice metrics
  | 'voice.minutes.authorized'
  | 'voice.calls.initiated'
  | 'voice.calls.completed'

  // API metrics
  | 'api.requests'
  | 'api.requests.successful'
  | 'api.requests.failed'

  // Scoring metrics
  | 'scoring.requests'
  | 'scoring.models.used'

  // Integration metrics
  | 'integrations.webhooks.received'
  | 'integrations.api.calls'

  // Storage metrics
  | 'storage.data_volume_gb'
  | 'storage.retention_days_used'

  // Team/User metrics
  | 'team.users.active'
  | 'team.concurrent_sessions';

/**
 * Usage event structure
 * Represents a single usage occurrence that should be recorded
 */
export interface UsageEvent {
  /** Event identifier */
  eventId: string;

  /** Tenant identifier */
  tenantId: string;

  /** Usage metric being tracked */
  metric: UsageMetric;

  /** Quantity of usage (default 1) */
  quantity: number;

  /** Timestamp of usage occurrence */
  timestamp: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Additional metadata about the usage */
  metadata?: Record<string, any>;

  /** Service that generated the event */
  sourceService: string;

  /** Version of the service that generated the event */
  sourceVersion?: SemanticVersion;
}

/**
 * Usage aggregate structure
 * Aggregated usage data for a tenant over a time period
 */
export interface UsageAggregate {
  /** Tenant identifier */
  tenantId: string;

  /** Time period for this aggregate (e.g., '2024-01') */
  period: string;

  /** Start of the aggregation period */
  periodStart: string;

  /** End of the aggregation period */
  periodEnd: string;

  /** Aggregated usage by metric */
  metrics: Record<UsageMetric, number>;

  /** Last update timestamp */
  lastUpdated: string;

  /** Number of events aggregated */
  eventCount: number;

  /** Metadata about aggregation */
  metadata?: {
    /** Aggregation method used */
    method: 'sum' | 'average' | 'max' | 'min';

    /** Whether this is a final/complete aggregate */
    isComplete: boolean;

    /** Any aggregation warnings or issues */
    warnings?: string[];
  };
}

/**
 * Usage threshold structure
 * Defines thresholds for usage monitoring and alerting
 */
export interface UsageThreshold {
  /** Threshold identifier */
  thresholdId: string;

  /** Tenant identifier (or 'global' for system-wide) */
  tenantId: string;

  /** Metric being monitored */
  metric: UsageMetric;

  /** Threshold value */
  value: number;

  /** Threshold type */
  type: 'warning' | 'critical' | 'limit';

  /** Time period for threshold evaluation */
  period: 'hourly' | 'daily' | 'monthly' | 'rolling_7d' | 'rolling_30d';

  /** Whether threshold is enabled */
  enabled: boolean;

  /** Actions to take when threshold is exceeded */
  actions?: ThresholdAction[];

  /** Creation timestamp */
  createdAt: string;

  /** Last evaluation timestamp */
  lastEvaluated?: string;
}

/**
 * Actions to take when usage thresholds are exceeded
 */
export interface ThresholdAction {
  /** Action type */
  type: 'alert' | 'notification' | 'throttle' | 'suspend' | 'webhook';

  /** Action configuration */
  config: Record<string, any>;

  /** Whether action is enabled */
  enabled: boolean;
}

/**
 * Usage report structure
 * Comprehensive usage report for a tenant over a time period
 */
export interface UsageReport {
  /** Report identifier */
  reportId: string;

  /** Tenant identifier */
  tenantId: string;

  /** Report period */
  period: string;

  /** Report generation timestamp */
  generatedAt: string;

  /** Total usage by metric */
  totals: Record<UsageMetric, number>;

  /** Daily breakdown */
  dailyBreakdown: Array<{
    date: string;
    metrics: Record<UsageMetric, number>;
  }>;

  /** Peak usage periods */
  peaks: Array<{
    metric: UsageMetric;
    value: number;
    timestamp: string;
  }>;

  /** Threshold violations */
  violations: Array<{
    thresholdId: string;
    metric: UsageMetric;
    actualValue: number;
    thresholdValue: number;
    timestamp: string;
  }>;

  /** Report metadata */
  metadata: {
    /** Total events processed */
    totalEvents: number;

    /** Data completeness percentage */
    completenessPercentage: number;

    /** Report generation duration */
    generationDurationMs: number;

    /** Any issues during report generation */
    issues?: string[];
  };
}

/**
 * Usage query options
 * Options for querying usage data
 */
export interface UsageQueryOptions {
  /** Tenant identifier */
  tenantId: string;

  /** Metrics to include (empty for all) */
  metrics?: UsageMetric[];

  /** Start date for query */
  startDate?: string;

  /** End date for query */
  endDate?: string;

  /** Aggregation period */
  period?: 'hourly' | 'daily' | 'weekly' | 'monthly';

  /** Limit results */
  limit?: number;

  /** Offset for pagination */
  offset?: number;

  /** Include raw events or just aggregates */
  includeEvents?: boolean;
}

/**
 * Usage service configuration
 */
export interface UsageServiceConfig {
  /** Whether usage tracking is enabled */
  enabled: boolean;

  /** Default aggregation period */
  defaultAggregationPeriod: 'hourly' | 'daily' | 'weekly' | 'monthly';

  /** How long to retain raw usage events */
  eventRetentionDays: number;

  /** How long to retain aggregated data */
  aggregateRetentionDays: number;

  /** Batch size for processing events */
  batchSize: number;

  /** Processing interval in milliseconds */
  processingIntervalMs: number;

  /** Whether to enable threshold monitoring */
  enableThresholds: boolean;

  /** Whether to generate periodic reports */
  enableReports: boolean;

  /** Report generation schedule */
  reportSchedule: 'daily' | 'weekly' | 'monthly';
}

/**
 * Usage processing result
 */
export interface UsageProcessingResult {
  /** Number of events processed */
  eventsProcessed: number;

  /** Number of aggregates updated */
  aggregatesUpdated: number;

  /** Number of thresholds evaluated */
  thresholdsEvaluated: number;

  /** Number of violations detected */
  violationsDetected: number;

  /** Processing duration in milliseconds */
  processingDurationMs: number;

  /** Any processing errors */
  errors?: string[];
}

/**
 * Usage event batch
 * For efficient processing of multiple events
 */
export interface UsageEventBatch {
  /** Batch identifier */
  batchId: string;

  /** Events in this batch */
  events: UsageEvent[];

  /** Batch creation timestamp */
  createdAt: string;

  /** Processing status */
  status: 'pending' | 'processing' | 'completed' | 'failed';

  /** Processing result */
  result?: UsageProcessingResult;
}

/**
 * Usage domain mapping
 * Maps service operations to usage metrics
 */
export const USAGE_DOMAIN_MAPPING: Record<string, UsageMetric[]> = {
  // Scoring service
  'advanced-scoring': ['scoring.requests', 'leads.processed'],

  // Routing services
  'lead-router': ['routing.decisions', 'leads.routed'],
  'predictive-routing': ['routing.decisions', 'routing.capacity_used'],

  // SLA service
  sla: [
    'sla.timers.started',
    'sla.timers.violated',
    'sla.escalations.triggered',
  ],

  // Voice service
  voice: [
    'voice.minutes.authorized',
    'voice.calls.initiated',
    'voice.calls.completed',
  ],

  // API endpoints
  api: ['api.requests', 'api.requests.successful', 'api.requests.failed'],

  // Integration services
  integrations: ['integrations.webhooks.received', 'integrations.api.calls'],
};

/**
 * Default usage service configuration
 */
export const DEFAULT_USAGE_CONFIG: UsageServiceConfig = {
  enabled: true,
  defaultAggregationPeriod: 'daily',
  eventRetentionDays: 30,
  aggregateRetentionDays: 365,
  batchSize: 1000,
  processingIntervalMs: 60000, // 1 minute
  enableThresholds: true,
  enableReports: true,
  reportSchedule: 'monthly',
};
