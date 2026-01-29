/**
 * Base Snapshot Ingestion - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Common functionality for all snapshot ingestion services.
 */

import { PrismaClient } from '@prisma/client';
import { Injectable, Logger } from '@nestjs/common';
import {
  GhlSnapshot,
  SnapshotType,
  SnapshotMetadata,
  SnapshotPayload,
} from '../snapshot-types';
import * as crypto from 'crypto';

@Injectable()
export abstract class BaseSnapshotIngestion {
  protected readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaClient,
    loggerContext: string
  ) {
    this.logger = new Logger(loggerContext);
  }

  /**
   * Main ingestion method to be implemented by subclasses
   */
  abstract ingest(
    tenantId: string,
    ghlAccountId: string,
    correlationId: string
  ): Promise<GhlSnapshot>;

  /**
   * Fetch data from GHL API (to be implemented by subclasses)
   */
  protected abstract fetchFromGhl(
    tenantId: string,
    ghlAccountId: string
  ): Promise<any[]>;

  /**
   * Create snapshot with common metadata
   */
  protected createSnapshot(
    tenantId: string,
    ghlAccountId: string,
    snapshotType: SnapshotType,
    data: any[],
    correlationId: string,
    source: 'scheduled' | 'manual' | 'api' = 'scheduled'
  ): GhlSnapshot {
    const capturedAt = new Date();
    const snapshotId = this.generateSnapshotId(
      tenantId,
      ghlAccountId,
      snapshotType,
      capturedAt
    );
    const checksum = this.calculateChecksum(data);

    const metadata: SnapshotMetadata = {
      snapshotId,
      tenantId,
      ghlAccountId,
      snapshotType,
      capturedAt,
      version: '1.0.0', // Schema version for forward compatibility
      status: 'success',
      recordCount: data.length,
      checksum,
    };

    const payload: SnapshotPayload = {
      data,
      metadata: {
        totalCount: data.length,
        hasMore: false, // Assume single page for now
        ghlApiVersion: 'v1',
        requestTimestamp: capturedAt,
      },
    };

    return {
      metadata,
      payload,
      audit: {
        createdAt: capturedAt,
        createdBy: 'system',
        source,
        correlationId,
      },
    };
  }

  /**
   * Generate unique snapshot ID
   */
  private generateSnapshotId(
    tenantId: string,
    ghlAccountId: string,
    snapshotType: SnapshotType,
    capturedAt: Date
  ): string {
    const timestamp = capturedAt.toISOString().replace(/[:.]/g, '-');
    return `snapshot_${tenantId}_${ghlAccountId}_${snapshotType}_${timestamp}`;
  }

  /**
   * Calculate checksum for data integrity
   */
  private calculateChecksum(data: any[]): string {
    const dataString = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  /**
   * Handle errors during ingestion
   */
  protected handleIngestionError(
    tenantId: string,
    ghlAccountId: string,
    snapshotType: SnapshotType,
    error: any,
    correlationId: string
  ): GhlSnapshot {
    this.logger.error(`Failed to ingest ${snapshotType} snapshot`, {
      tenantId,
      ghlAccountId,
      error: error.message,
      correlationId,
    });

    const capturedAt = new Date();
    const snapshotId = this.generateSnapshotId(
      tenantId,
      ghlAccountId,
      snapshotType,
      capturedAt
    );

    return {
      metadata: {
        snapshotId,
        tenantId,
        ghlAccountId,
        snapshotType,
        capturedAt,
        version: '1.0.0',
        status: 'failed',
        recordCount: 0,
        checksum: 'failed',
      },
      payload: {
        data: [],
        metadata: {
          requestTimestamp: capturedAt,
        },
      },
      audit: {
        createdAt: capturedAt,
        createdBy: 'system',
        source: 'scheduled',
        correlationId,
      },
    };
  }
}
