/**
 * Cleanup Types - WI-023: Data Retention & Cleanup Runners
 *
 * Types for cleanup operations and results.
 */

export interface CleanupResult {
  tableName: string;
  deletedCount: number;
  durationMs: number;
  error?: string;
  skipped?: boolean; // If operation was skipped (e.g., lock not acquired)
}

export interface CleanupRunResult {
  runId: string;
  startTime: Date;
  endTime: Date;
  durationMs: number;
  lockAcquired: boolean;
  results: CleanupResult[];
  totalDeleted: number;
  errors: string[];
}

export interface CleanupOperation {
  name: string;
  description: string;
  execute: () => Promise<CleanupResult>;
}

export interface CleanupBatchResult {
  processedCount: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface ArtifactCleanupResult {
  tenantId: string;
  objectKey: string;
  deleted: boolean;
  error?: string;
}

export interface StorageDeleteResult {
  tenantId: string;
  objectKey: string;
  deleted: boolean;
  error?: string;
}

// Advisory lock constants
export const CLEANUP_LOCK_KEY = 0x4e6575726f6e58; // 'NeuronX' in hex

// Cleanup table priorities (lower number = higher priority)
export enum CleanupPriority {
  OUTBOX = 1,
  WEBHOOKS = 2,
  AUDIT = 3,
  ARTIFACTS = 4,
  USAGE = 5,
}

// Cleanup operation status
export enum CleanupStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped', // Lock not acquired
}

// Table-specific cleanup metadata
export interface TableCleanupConfig {
  tableName: string;
  priority: CleanupPriority;
  description: string;
  batchSize: number;
  estimatedRowsPerSecond: number; // For progress estimation
}

// Cleanup metrics for monitoring
export interface CleanupMetrics {
  runId: string;
  startTime: Date;
  endTime: Date;
  tablesProcessed: number;
  totalRowsDeleted: number;
  totalErrors: number;
  lockWaitTimeMs: number;
  averageBatchTimeMs: number;
  memoryUsagePeak: number;
}
