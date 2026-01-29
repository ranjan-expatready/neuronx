/**
 * Scorecard Engine Types - WI-065: Scorecard Engine & Analytics Integration
 *
 * Core types for role-specific scorecards with policy-driven metrics and evidence.
 */

import { z } from 'zod';

/**
 * Role surfaces for scorecards
 */
export enum RoleSurface {
  OPERATOR = 'OPERATOR', // Front-line operators
  MANAGER = 'MANAGER', // Team managers
  EXECUTIVE = 'EXECUTIVE', // Executives/C-suite
}

/**
 * Time range options
 */
export enum TimeRange {
  LAST_7_DAYS = '7d',
  LAST_30_DAYS = '30d',
  LAST_90_DAYS = '90d',
}

/**
 * Metric performance bands
 */
export enum PerformanceBand {
  GREEN = 'GREEN', // Good performance
  YELLOW = 'YELLOW', // Needs attention
  RED = 'RED', // Critical issues
}

/**
 * Metric evidence reference
 */
export interface MetricEvidence {
  /** Source system that provided the data */
  source:
    | 'audit_log'
    | 'usage_meter'
    | 'drift_events'
    | 'readiness'
    | 'billing'
    | 'fsm'
    | 'decisions'
    | 'error';

  /** Query parameters used to retrieve the data */
  queryParams: Record<string, any>;

  /** Policy version that defined this metric */
  policyVersion: string;

  /** Correlation IDs for traceability */
  correlationIds: string[];

  /** Number of records/events that contributed to this metric */
  recordCount: number;

  /** Timestamp when evidence was gathered */
  timestamp: Date;
}

/**
 * Individual scorecard metric
 */
export interface ScorecardMetric {
  /** Unique metric key */
  key: string;

  /** Human-readable label */
  label: string;

  /** Detailed description */
  description: string;

  /** Current value */
  value: number;

  /** Previous period value for trend calculation */
  previousValue?: number;

  /** Unit of measurement */
  unit: string;

  /** Performance band based on thresholds */
  band: PerformanceBand;

  /** Evidence references for drill-down */
  evidence: MetricEvidence;

  /** Optional trend direction (-1, 0, 1 for down, flat, up) */
  trend?: number;
}

/**
 * Scorecard section grouping metrics
 */
export interface ScorecardSection {
  /** Section key */
  key: string;

  /** Human-readable title */
  title: string;

  /** Section description */
  description: string;

  /** Metrics in this section */
  metrics: ScorecardMetric[];

  /** Overall section band based on worst metric */
  overallBand: PerformanceBand;
}

/**
 * Complete scorecard for a role surface
 */
export interface Scorecard {
  /** Tenant identifier */
  tenantId: string;

  /** Role surface this scorecard is for */
  surface: RoleSurface;

  /** Time range covered */
  timeRange: TimeRange;

  /** Optional team filter */
  teamId?: string;

  /** Optional user filter */
  userId?: string;

  /** When this scorecard was generated */
  generatedAt: Date;

  /** Policy version used */
  policyVersion: string;

  /** Correlation ID for this scorecard generation */
  correlationId: string;

  /** Scorecard sections */
  sections: ScorecardSection[];

  /** Overall scorecard band */
  overallBand: PerformanceBand;
}

/**
 * Drill-down result for a specific metric
 */
export interface MetricDrilldown {
  /** Metric key */
  metricKey: string;

  /** Records/events that contributed to the metric */
  records: Array<{
    id: string;
    type: string;
    timestamp: Date;
    details: Record<string, any>;
  }>;

  /** Pagination info */
  pagination: {
    total: number;
    page: number;
    limit: number;
  };
}

/**
 * Scorecard query parameters
 */
export interface ScorecardQuery {
  tenantId: string;
  surface: RoleSurface;
  timeRange: TimeRange;
  teamId?: string;
  userId?: string;
  includeDetails?: boolean;
}

/**
 * Drill-down query parameters
 */
export interface DrilldownQuery {
  tenantId: string;
  metricKey: string;
  timeRange: TimeRange;
  teamId?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

/**
 * Zod schemas for runtime validation
 */
export const RoleSurfaceSchema = z.nativeEnum(RoleSurface);
export const TimeRangeSchema = z.nativeEnum(TimeRange);
export const PerformanceBandSchema = z.nativeEnum(PerformanceBand);

export const MetricEvidenceSchema = z.object({
  source: z.enum([
    'audit_log',
    'usage_meter',
    'drift_events',
    'readiness',
    'billing',
    'fsm',
    'decisions',
    'error',
  ]),
  queryParams: z.record(z.any()),
  policyVersion: z.string(),
  correlationIds: z.array(z.string()),
  recordCount: z.number().min(0),
  timestamp: z.date(),
});

export const ScorecardMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  value: z.number(),
  previousValue: z.number().optional(),
  unit: z.string(),
  band: PerformanceBandSchema,
  evidence: MetricEvidenceSchema,
  trend: z.number().min(-1).max(1).optional(),
});

export const ScorecardSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  metrics: z.array(ScorecardMetricSchema),
  overallBand: PerformanceBandSchema,
});

export const ScorecardSchema = z.object({
  tenantId: z.string(),
  surface: RoleSurfaceSchema,
  timeRange: TimeRangeSchema,
  teamId: z.string().optional(),
  userId: z.string().optional(),
  generatedAt: z.date(),
  policyVersion: z.string(),
  correlationId: z.string(),
  sections: z.array(ScorecardSectionSchema),
  overallBand: PerformanceBandSchema,
});

export const MetricDrilldownSchema = z.object({
  metricKey: z.string(),
  records: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      timestamp: z.date(),
      details: z.record(z.any()),
    })
  ),
  pagination: z.object({
    total: z.number(),
    page: z.number(),
    limit: z.number(),
  }),
});
