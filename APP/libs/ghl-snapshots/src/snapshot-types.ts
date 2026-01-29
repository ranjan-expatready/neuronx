/**
 * GHL Snapshot Types - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Types and schemas for immutable GHL configuration snapshots.
 */

import { z } from 'zod';

// Snapshot types - what we capture from GHL
export enum SnapshotType {
  LOCATIONS = 'locations',
  PIPELINES = 'pipelines',
  WORKFLOWS = 'workflows',
  CALENDARS = 'calendars',
  AI_WORKERS = 'ai_workers',
}

// Core snapshot metadata
export interface SnapshotMetadata {
  snapshotId: string;
  tenantId: string;
  ghlAccountId: string;
  snapshotType: SnapshotType;
  capturedAt: Date;
  version: string; // For schema versioning
  status: 'success' | 'partial_failure' | 'failed';
  recordCount: number;
  checksum: string; // For integrity verification
}

// Raw snapshot payload (preserved as-is from GHL)
export interface SnapshotPayload {
  data: any[]; // Array of GHL entities
  metadata: {
    totalCount?: number;
    hasMore?: boolean;
    nextCursor?: string;
    ghlApiVersion?: string;
    requestTimestamp: Date;
  };
}

// Complete snapshot record
export interface GhlSnapshot {
  metadata: SnapshotMetadata;
  payload: SnapshotPayload;
  audit: {
    createdAt: Date;
    createdBy: string; // 'system' for automated snapshots
    source: 'scheduled' | 'manual' | 'api';
    correlationId: string;
  };
}

// Snapshot ingestion result
export interface SnapshotIngestionResult {
  snapshotId: string;
  snapshotType: SnapshotType;
  success: boolean;
  recordCount: number;
  errors: SnapshotError[];
  durationMs: number;
  checksum: string;
  data?: any[]; // Optional data for immediate processing
}

// Error during snapshot ingestion
export interface SnapshotError {
  entityId?: string;
  entityType: string;
  error: string;
  timestamp: Date;
}

// Snapshot query parameters
export interface SnapshotQuery {
  tenantId: string;
  ghlAccountId?: string;
  snapshotType?: SnapshotType;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

// Snapshot storage interface
export interface SnapshotStorage {
  store(snapshot: GhlSnapshot): Promise<void>;
  retrieve(snapshotId: string): Promise<GhlSnapshot | null>;
  query(query: SnapshotQuery): Promise<GhlSnapshot[]>;
  getLatest(
    tenantId: string,
    snapshotType: SnapshotType
  ): Promise<GhlSnapshot | null>;
  delete(snapshotId: string): Promise<void>;
}

// Zod schemas for validation
export const SnapshotMetadataSchema = z.object({
  snapshotId: z.string().min(1),
  tenantId: z.string().min(1),
  ghlAccountId: z.string().min(1),
  snapshotType: z.nativeEnum(SnapshotType),
  capturedAt: z.date(),
  version: z.string().min(1),
  status: z.enum(['success', 'partial_failure', 'failed']),
  recordCount: z.number().min(0),
  checksum: z.string().min(1),
});

export const SnapshotPayloadSchema = z.object({
  data: z.array(z.any()),
  metadata: z.object({
    totalCount: z.number().optional(),
    hasMore: z.boolean().optional(),
    nextCursor: z.string().optional(),
    ghlApiVersion: z.string().optional(),
    requestTimestamp: z.date(),
  }),
});

export const GhlSnapshotSchema = z.object({
  metadata: SnapshotMetadataSchema,
  payload: SnapshotPayloadSchema,
  audit: z.object({
    createdAt: z.date(),
    createdBy: z.string().min(1),
    source: z.enum(['scheduled', 'manual', 'api']),
    correlationId: z.string().min(1),
  }),
});

export const SnapshotIngestionResultSchema = z.object({
  snapshotId: z.string().min(1),
  snapshotType: z.nativeEnum(SnapshotType),
  success: z.boolean(),
  recordCount: z.number().min(0),
  errors: z.array(
    z.object({
      entityId: z.string().optional(),
      entityType: z.string().min(1),
      error: z.string().min(1),
      timestamp: z.date(),
    })
  ),
  durationMs: z.number().min(0),
  checksum: z.string().min(1),
});

// Ingestion configuration
export interface SnapshotIngestionConfig {
  enabled: boolean;
  batchSize: number;
  timeoutMs: number;
  retryAttempts: number;
  rateLimitDelayMs: number;
}

// Default configuration
export const DEFAULT_SNAPSHOT_INGESTION_CONFIG: SnapshotIngestionConfig = {
  enabled: true,
  batchSize: 100,
  timeoutMs: 30000, // 30 seconds
  retryAttempts: 3,
  rateLimitDelayMs: 1000, // 1 second
};
