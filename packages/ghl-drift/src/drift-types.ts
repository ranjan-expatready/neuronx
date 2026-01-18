/**
 * GHL Drift Detection Types - WI-053: Drift Detection Engine
 *
 * Types and schemas for detecting and classifying GHL configuration drift.
 */

import { z } from 'zod';
import { SnapshotType } from '@neuronx/ghl-snapshots';

// Drift change types
export enum DriftChangeType {
  ADDED = 'ADDED',
  REMOVED = 'REMOVED',
  MODIFIED = 'MODIFIED',
}

// Drift categories - what type of configuration changed
export enum DriftCategory {
  CONFIG_DRIFT = 'CONFIG_DRIFT', // Pipeline stages, workflow settings
  CAPABILITY_DRIFT = 'CAPABILITY_DRIFT', // AI workers, messaging features
  STRUCTURAL_DRIFT = 'STRUCTURAL_DRIFT', // Deleted entities, renamed items
  COSMETIC_DRIFT = 'COSMETIC_DRIFT', // Labels, descriptions, non-functional
}

// Drift severity levels
export enum DriftSeverity {
  LOW = 'LOW', // Cosmetic changes, no functional impact
  MEDIUM = 'MEDIUM', // Operational changes, minor impact
  HIGH = 'HIGH', // Execution-impacting changes
  CRITICAL = 'CRITICAL', // Policy/capability violations
}

// Individual drift change
export interface DriftChange {
  changeType: DriftChangeType;
  entityId: string;
  entityType: string;
  diffPath: string; // JSON path to the changed field
  beforeValue?: any; // Value in before snapshot
  afterValue?: any; // Value in after snapshot
  category: DriftCategory;
  severity: DriftSeverity;
  description: string; // Human-readable description
  metadata?: Record<string, any>; // Additional context
}

// Complete drift detection result
export interface DriftDetectionResult {
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

// Drift detection request
export interface DriftDetectionRequest {
  tenantId: string;
  ghlAccountId: string;
  snapshotType: SnapshotType;
  beforeSnapshotId?: string; // If not provided, use latest - 1
  afterSnapshotId?: string; // If not provided, use latest
  correlationId: string;
}

// Drift detection response
export interface DriftDetectionResponse {
  success: boolean;
  driftResult?: DriftDetectionResult;
  error?: string;
  durationMs: number;
}

// Drift storage interface
export interface DriftStorage {
  store(result: DriftDetectionResult): Promise<void>;
  retrieve(driftId: string): Promise<DriftDetectionResult | null>;
  query(
    tenantId: string,
    snapshotType?: SnapshotType,
    limit?: number
  ): Promise<DriftDetectionResult[]>;
  getLatestDrift(
    tenantId: string,
    snapshotType: SnapshotType
  ): Promise<DriftDetectionResult | null>;
}

// Drift classifier interface
export interface DriftClassifier {
  classifyChange(change: Omit<DriftChange, 'category' | 'severity'>): {
    category: DriftCategory;
    severity: DriftSeverity;
  };
}

// Zod schemas for validation
export const DriftChangeSchema = z.object({
  changeType: z.nativeEnum(DriftChangeType),
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  diffPath: z.string().min(1),
  beforeValue: z.any().optional(),
  afterValue: z.any().optional(),
  category: z.nativeEnum(DriftCategory),
  severity: z.nativeEnum(DriftSeverity),
  description: z.string().min(1),
  metadata: z.record(z.any()).optional(),
});

export const DriftDetectionResultSchema = z.object({
  driftId: z.string().min(1),
  tenantId: z.string().min(1),
  ghlAccountId: z.string().min(1),
  snapshotType: z.nativeEnum(SnapshotType),
  beforeSnapshotId: z.string().min(1),
  afterSnapshotId: z.string().min(1),
  detectedAt: z.date(),
  changes: z.array(DriftChangeSchema),
  summary: z.object({
    totalChanges: z.number().min(0),
    changesByType: z.record(z.nativeEnum(DriftChangeType), z.number()),
    changesByCategory: z.record(z.nativeEnum(DriftCategory), z.number()),
    maxSeverity: z.nativeEnum(DriftSeverity),
    hasCriticalChanges: z.boolean(),
  }),
  metadata: z.object({
    beforeCapturedAt: z.date(),
    afterCapturedAt: z.date(),
    timeSpanMs: z.number().min(0),
    correlationId: z.string().min(1),
  }),
});

export const DriftDetectionRequestSchema = z.object({
  tenantId: z.string().min(1),
  ghlAccountId: z.string().min(1),
  snapshotType: z.nativeEnum(SnapshotType),
  beforeSnapshotId: z.string().optional(),
  afterSnapshotId: z.string().optional(),
  correlationId: z.string().min(1),
});

// Drift detector interface
export interface DriftDetector {
  detectDrift(
    beforeSnapshot: any,
    afterSnapshot: any,
    context: {
      tenantId: string;
      ghlAccountId: string;
      correlationId: string;
    }
  ): Promise<DriftChange[]>;
}

// Configuration
export interface DriftDetectionConfig {
  enabled: boolean;
  maxChangesPerDetection: number;
  severityThresholds: {
    alertOnSeverity: DriftSeverity;
    criticalCategories: DriftCategory[];
  };
  performanceLimits: {
    maxDetectionTimeMs: number;
    maxMemoryUsageMb: number;
  };
}

export const DEFAULT_DRIFT_DETECTION_CONFIG: DriftDetectionConfig = {
  enabled: true,
  maxChangesPerDetection: 1000,
  severityThresholds: {
    alertOnSeverity: DriftSeverity.HIGH,
    criticalCategories: [
      DriftCategory.CAPABILITY_DRIFT,
      DriftCategory.STRUCTURAL_DRIFT,
    ],
  },
  performanceLimits: {
    maxDetectionTimeMs: 30000, // 30 seconds
    maxMemoryUsageMb: 512,
  },
};
