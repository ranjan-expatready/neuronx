/**
 * Drift Storage Service - WI-053: Drift Detection Engine
 *
 * Storage for drift detection results.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { DriftStorage, DriftDetectionResult } from './drift-types';

@Injectable()
export class DriftStorageService implements DriftStorage {
  private readonly logger = new Logger(DriftStorageService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Store a drift detection result
   */
  async store(result: DriftDetectionResult): Promise<void> {
    try {
      await this.prisma.ghlDrift.create({
        data: {
          driftId: result.driftId,
          tenantId: result.tenantId,
          ghlAccountId: result.ghlAccountId,
          snapshotType: result.snapshotType,
          beforeSnapshotId: result.beforeSnapshotId,
          afterSnapshotId: result.afterSnapshotId,
          detectedAt: result.detectedAt,
          changes: result.changes as any, // JSON storage
          summary: result.summary as any, // JSON storage
          beforeCapturedAt: result.metadata.beforeCapturedAt,
          afterCapturedAt: result.metadata.afterCapturedAt,
          timeSpanMs: result.metadata.timeSpanMs,
          correlationId: result.metadata.correlationId,
        },
      });

      this.logger.debug('Stored GHL drift result', {
        driftId: result.driftId,
        tenantId: result.tenantId,
        totalChanges: result.summary.totalChanges,
        maxSeverity: result.summary.maxSeverity,
      });
    } catch (error) {
      this.logger.error('Failed to store GHL drift result', {
        driftId: result.driftId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Retrieve a specific drift result by ID
   */
  async retrieve(driftId: string): Promise<DriftDetectionResult | null> {
    try {
      const record = await this.prisma.ghlDrift.findUnique({
        where: { driftId },
      });

      if (!record) {
        return null;
      }

      return {
        driftId: record.driftId,
        tenantId: record.tenantId,
        ghlAccountId: record.ghlAccountId,
        snapshotType: record.snapshotType as any,
        beforeSnapshotId: record.beforeSnapshotId,
        afterSnapshotId: record.afterSnapshotId,
        detectedAt: record.detectedAt,
        changes: record.changes as any,
        summary: record.summary as any,
        metadata: {
          beforeCapturedAt: record.beforeCapturedAt,
          afterCapturedAt: record.afterCapturedAt,
          timeSpanMs: record.timeSpanMs,
          correlationId: record.correlationId,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve GHL drift result', {
        driftId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Query drift results with filters
   */
  async query(
    tenantId: string,
    snapshotType?: any,
    limit?: number
  ): Promise<DriftDetectionResult[]> {
    try {
      const where: any = { tenantId };

      if (snapshotType) {
        where.snapshotType = snapshotType;
      }

      const records = await this.prisma.ghlDrift.findMany({
        where,
        orderBy: { detectedAt: 'desc' },
        take: limit || 50,
      });

      return records.map(record => ({
        driftId: record.driftId,
        tenantId: record.tenantId,
        ghlAccountId: record.ghlAccountId,
        snapshotType: record.snapshotType as any,
        beforeSnapshotId: record.beforeSnapshotId,
        afterSnapshotId: record.afterSnapshotId,
        detectedAt: record.detectedAt,
        changes: record.changes as any,
        summary: record.summary as any,
        metadata: {
          beforeCapturedAt: record.beforeCapturedAt,
          afterCapturedAt: record.afterCapturedAt,
          timeSpanMs: record.timeSpanMs,
          correlationId: record.correlationId,
        },
      }));
    } catch (error) {
      this.logger.error('Failed to query GHL drift results', {
        tenantId,
        snapshotType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get the latest drift result for a tenant and type
   */
  async getLatestDrift(
    tenantId: string,
    snapshotType: any
  ): Promise<DriftDetectionResult | null> {
    try {
      const record = await this.prisma.ghlDrift.findFirst({
        where: {
          tenantId,
          snapshotType,
        },
        orderBy: { detectedAt: 'desc' },
      });

      if (!record) {
        return null;
      }

      return {
        driftId: record.driftId,
        tenantId: record.tenantId,
        ghlAccountId: record.ghlAccountId,
        snapshotType: record.snapshotType as any,
        beforeSnapshotId: record.beforeSnapshotId,
        afterSnapshotId: record.afterSnapshotId,
        detectedAt: record.detectedAt,
        changes: record.changes as any,
        summary: record.summary as any,
        metadata: {
          beforeCapturedAt: record.beforeCapturedAt,
          afterCapturedAt: record.afterCapturedAt,
          timeSpanMs: record.timeSpanMs,
          correlationId: record.correlationId,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get latest GHL drift result', {
        tenantId,
        snapshotType,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get drift detection statistics
   */
  async getStats(tenantId?: string): Promise<{
    totalDrifts: number;
    driftsByType: Record<string, number>;
    driftsBySeverity: Record<string, number>;
    oldestDrift?: Date;
    newestDrift?: Date;
    criticalDriftCount: number;
  }> {
    try {
      const where = tenantId ? { tenantId } : {};

      const [totalCount, typeStats, severityStats, dateRange] =
        await Promise.all([
          this.prisma.ghlDrift.count({ where }),
          this.prisma.ghlDrift.groupBy({
            by: ['snapshotType'],
            where,
            _count: { snapshotType: true },
          }),
          this.prisma.ghlDrift.findMany({
            where,
            select: { summary: true },
          }),
          this.prisma.ghlDrift.aggregate({
            where,
            _min: { detectedAt: true },
            _max: { detectedAt: true },
          }),
        ]);

      const driftsByType: Record<string, number> = {};
      typeStats.forEach(stat => {
        driftsByType[stat.snapshotType] = stat._count.snapshotType;
      });

      const driftsBySeverity: Record<string, number> = {};
      let criticalDriftCount = 0;

      severityStats.forEach(record => {
        const summary = record.summary as any;
        if (summary?.maxSeverity) {
          driftsBySeverity[summary.maxSeverity] =
            (driftsBySeverity[summary.maxSeverity] || 0) + 1;
        }
        if (summary?.hasCriticalChanges) {
          criticalDriftCount++;
        }
      });

      return {
        totalDrifts: totalCount,
        driftsByType,
        driftsBySeverity,
        oldestDrift: dateRange._min.detectedAt || undefined,
        newestDrift: dateRange._max.detectedAt || undefined,
        criticalDriftCount,
      };
    } catch (error) {
      this.logger.error('Failed to get drift stats', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }
}
