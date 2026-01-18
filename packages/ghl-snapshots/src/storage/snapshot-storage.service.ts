/**
 * Snapshot Storage Service - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Immutable storage for GHL configuration snapshots.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { GhlSnapshot, SnapshotQuery, SnapshotStorage } from '../snapshot-types';

@Injectable()
export class SnapshotStorageService implements SnapshotStorage {
  private readonly logger = new Logger(SnapshotStorageService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Store a snapshot immutably
   */
  async store(snapshot: GhlSnapshot): Promise<void> {
    const { metadata, payload, audit } = snapshot;

    try {
      await this.prisma.ghlSnapshot.create({
        data: {
          snapshotId: metadata.snapshotId,
          tenantId: metadata.tenantId,
          ghlAccountId: metadata.ghlAccountId,
          snapshotType: metadata.snapshotType,
          capturedAt: metadata.capturedAt,
          version: metadata.version,
          status: metadata.status,
          recordCount: metadata.recordCount,
          checksum: metadata.checksum,
          payload: payload as any, // JSON storage
          createdAt: audit.createdAt,
          createdBy: audit.createdBy,
          source: audit.source,
          correlationId: audit.correlationId,
        },
      });

      this.logger.debug(`Stored GHL snapshot`, {
        snapshotId: metadata.snapshotId,
        snapshotType: metadata.snapshotType,
        recordCount: metadata.recordCount,
        tenantId: metadata.tenantId,
      });
    } catch (error) {
      this.logger.error(`Failed to store GHL snapshot`, {
        snapshotId: metadata.snapshotId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Retrieve a specific snapshot by ID
   */
  async retrieve(snapshotId: string): Promise<GhlSnapshot | null> {
    try {
      const record = await this.prisma.ghlSnapshot.findUnique({
        where: { snapshotId },
      });

      if (!record) {
        return null;
      }

      return {
        metadata: {
          snapshotId: record.snapshotId,
          tenantId: record.tenantId,
          ghlAccountId: record.ghlAccountId,
          snapshotType: record.snapshotType as any,
          capturedAt: record.capturedAt,
          version: record.version,
          status: record.status as any,
          recordCount: record.recordCount,
          checksum: record.checksum,
        },
        payload: record.payload as any,
        audit: {
          createdAt: record.createdAt,
          createdBy: record.createdBy,
          source: record.source as any,
          correlationId: record.correlationId,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to retrieve GHL snapshot`, {
        snapshotId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Query snapshots with filters
   */
  async query(query: SnapshotQuery): Promise<GhlSnapshot[]> {
    try {
      const where: any = {
        tenantId: query.tenantId,
      };

      if (query.ghlAccountId) {
        where.ghlAccountId = query.ghlAccountId;
      }

      if (query.snapshotType) {
        where.snapshotType = query.snapshotType;
      }

      if (query.fromDate || query.toDate) {
        where.capturedAt = {};
        if (query.fromDate) {
          where.capturedAt.gte = query.fromDate;
        }
        if (query.toDate) {
          where.capturedAt.lte = query.toDate;
        }
      }

      const records = await this.prisma.ghlSnapshot.findMany({
        where,
        orderBy: { capturedAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      });

      return records.map(record => ({
        metadata: {
          snapshotId: record.snapshotId,
          tenantId: record.tenantId,
          ghlAccountId: record.ghlAccountId,
          snapshotType: record.snapshotType as any,
          capturedAt: record.capturedAt,
          version: record.version,
          status: record.status as any,
          recordCount: record.recordCount,
          checksum: record.checksum,
        },
        payload: record.payload as any,
        audit: {
          createdAt: record.createdAt,
          createdBy: record.createdBy,
          source: record.source as any,
          correlationId: record.correlationId,
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to query GHL snapshots`, {
        query,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get the latest snapshot for a tenant and type
   */
  async getLatest(
    tenantId: string,
    snapshotType: any
  ): Promise<GhlSnapshot | null> {
    try {
      const record = await this.prisma.ghlSnapshot.findFirst({
        where: {
          tenantId,
          snapshotType,
        },
        orderBy: { capturedAt: 'desc' },
      });

      if (!record) {
        return null;
      }

      return {
        metadata: {
          snapshotId: record.snapshotId,
          tenantId: record.tenantId,
          ghlAccountId: record.ghlAccountId,
          snapshotType: record.snapshotType as any,
          capturedAt: record.capturedAt,
          version: record.version,
          status: record.status as any,
          recordCount: record.recordCount,
          checksum: record.checksum,
        },
        payload: record.payload as any,
        audit: {
          createdAt: record.createdAt,
          createdBy: record.createdBy,
          source: record.source as any,
          correlationId: record.correlationId,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get latest GHL snapshot`, {
        tenantId,
        snapshotType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete a snapshot (admin operation)
   */
  async delete(snapshotId: string): Promise<void> {
    try {
      await this.prisma.ghlSnapshot.delete({
        where: { snapshotId },
      });

      this.logger.debug(`Deleted GHL snapshot`, { snapshotId });
    } catch (error) {
      this.logger.error(`Failed to delete GHL snapshot`, {
        snapshotId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(tenantId?: string): Promise<{
    totalSnapshots: number;
    snapshotsByType: Record<string, number>;
    oldestSnapshot?: Date;
    newestSnapshot?: Date;
  }> {
    try {
      const where = tenantId ? { tenantId } : {};

      const [totalCount, typeStats, dateRange] = await Promise.all([
        this.prisma.ghlSnapshot.count({ where }),
        this.prisma.ghlSnapshot.groupBy({
          by: ['snapshotType'],
          where,
          _count: { snapshotType: true },
        }),
        this.prisma.ghlSnapshot.aggregate({
          where,
          _min: { capturedAt: true },
          _max: { capturedAt: true },
        }),
      ]);

      const snapshotsByType: Record<string, number> = {};
      typeStats.forEach(stat => {
        snapshotsByType[stat.snapshotType] = stat._count.snapshotType;
      });

      return {
        totalSnapshots: totalCount,
        snapshotsByType,
        oldestSnapshot: dateRange._min.capturedAt || undefined,
        newestSnapshot: dateRange._max.capturedAt || undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to get snapshot stats`, {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }
}
