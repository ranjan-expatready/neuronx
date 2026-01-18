/**
 * Cleanup Repository - WI-023: Data Retention & Cleanup Runners
 *
 * Safe batched deletion operations for all cleanup tables.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { StorageProvider } from '../storage/storage.types';
import { RetentionConfig, getRetentionCutoff } from './retention.config';
import {
  CleanupResult,
  CleanupBatchResult,
  ArtifactCleanupResult,
  StorageDeleteResult,
} from './cleanup.types';
import {
  cleanupMetrics,
  validateCleanupTableName,
} from '../observability/metrics';

@Injectable()
export class CleanupRepository {
  private readonly logger = new Logger(CleanupRepository.name);

  constructor(
    @Inject('PrismaClient')
    private readonly prisma: PrismaClient,
    private readonly storageProvider: StorageProvider,
    private readonly retentionConfig: RetentionConfig
  ) {}

  // ============================================================================
  // OUTBOX EVENTS CLEANUP (WI-014)
  // ============================================================================

  async cleanupOutboxEvents(): Promise<CleanupResult> {
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      // Delete published events older than retention
      const publishedCutoff = getRetentionCutoff(
        this.retentionConfig.outbox.publishedRetentionDays
      );
      const publishedResult = await this.prisma.outboxEvent.deleteMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: {
            lt: publishedCutoff,
          },
        },
      });
      totalDeleted += publishedResult.count;

      // Delete dead/failed events older than retention (longer retention for troubleshooting)
      const deadCutoff = getRetentionCutoff(
        this.retentionConfig.outbox.deadRetentionDays
      );
      const deadResult = await this.prisma.outboxEvent.deleteMany({
        where: {
          status: { in: ['FAILED', 'DEAD_LETTER'] },
          createdAt: {
            lt: deadCutoff,
          },
          // Safety: Never delete PENDING or PROCESSING events
          NOT: {
            status: { in: ['PENDING', 'PROCESSING'] },
          },
        },
      });
      totalDeleted += deadResult.count;

      const duration = Date.now() - startTime;

      // Record metrics
      cleanupMetrics.deletedRowsTotal
        .labels({ table_name: validateCleanupTableName('outbox_events') })
        .inc(totalDeleted);

      this.logger.log(`Cleaned up ${totalDeleted} outbox events`, {
        publishedDeleted: publishedResult.count,
        deadDeleted: deadResult.count,
        durationMs: duration,
      });

      return {
        tableName: 'outbox_events',
        deletedCount: totalDeleted,
        durationMs: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup outbox events`, {
        error: error.message,
        durationMs: duration,
      });

      return {
        tableName: 'outbox_events',
        deletedCount: 0,
        durationMs: duration,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // WEBHOOK DELIVERIES CLEANUP (WI-018)
  // ============================================================================

  async cleanupWebhookDeliveries(): Promise<CleanupResult> {
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      // Get deliveries that can be cleaned up (delivered or dead-lettered)
      const cleanableDeliveries = await this.prisma.webhookDelivery.findMany({
        where: {
          status: { in: ['DELIVERED', 'DEAD_LETTER'] },
        },
        select: { id: true, tenantId: true },
      });

      if (cleanableDeliveries.length === 0) {
        return {
          tableName: 'webhook_deliveries',
          deletedCount: 0,
          durationMs: Date.now() - startTime,
        };
      }

      const deliveryIds = cleanableDeliveries.map(d => d.id);

      // Delete attempts for cleanable deliveries first
      const attemptsCutoff = getRetentionCutoff(
        Math.max(
          this.retentionConfig.webhooks.deliveredRetentionDays,
          this.retentionConfig.webhooks.deadRetentionDays
        )
      );

      const attemptsResult = await this.prisma.webhookAttempt.deleteMany({
        where: {
          deliveryId: { in: deliveryIds },
          createdAt: { lt: attemptsCutoff },
        },
      });
      totalDeleted += attemptsResult.count;

      // Delete deliveries older than appropriate retention
      const deliveredCutoff = getRetentionCutoff(
        this.retentionConfig.webhooks.deliveredRetentionDays
      );
      const deadCutoff = getRetentionCutoff(
        this.retentionConfig.webhooks.deadRetentionDays
      );

      // Delete delivered deliveries
      const deliveredResult = await this.prisma.webhookDelivery.deleteMany({
        where: {
          status: 'DELIVERED',
          createdAt: { lt: deliveredCutoff },
        },
      });
      totalDeleted += deliveredResult.count;

      // Delete dead-lettered deliveries
      const deadResult = await this.prisma.webhookDelivery.deleteMany({
        where: {
          status: 'DEAD_LETTER',
          createdAt: { lt: deadCutoff },
        },
      });
      totalDeleted += deadResult.count;

      const duration = Date.now() - startTime;

      // Record metrics
      cleanupMetrics.deletedRowsTotal
        .labels({ table_name: validateCleanupTableName('webhook_deliveries') })
        .inc(totalDeleted);

      this.logger.log(`Cleaned up ${totalDeleted} webhook records`, {
        attemptsDeleted: attemptsResult.count,
        deliveredDeleted: deliveredResult.count,
        deadDeleted: deadResult.count,
        durationMs: duration,
      });

      return {
        tableName: 'webhook_deliveries',
        deletedCount: totalDeleted,
        durationMs: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup webhook deliveries`, {
        error: error.message,
        durationMs: duration,
      });

      return {
        tableName: 'webhook_deliveries',
        deletedCount: 0,
        durationMs: duration,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // AUDIT LOGS CLEANUP (WI-022)
  // ============================================================================

  async cleanupAuditLogs(): Promise<CleanupResult> {
    const startTime = Date.now();

    try {
      const cutoff = getRetentionCutoff(
        this.retentionConfig.audit.retentionDays
      );

      const result = await this.prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoff },
        },
      });

      const duration = Date.now() - startTime;

      // Record metrics
      cleanupMetrics.deletedRowsTotal
        .labels({ table_name: validateCleanupTableName('audit_logs') })
        .inc(result.count);

      this.logger.log(`Cleaned up ${result.count} audit log entries`, {
        cutoffDate: cutoff.toISOString(),
        durationMs: duration,
      });

      return {
        tableName: 'audit_logs',
        deletedCount: result.count,
        durationMs: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup audit logs`, {
        error: error.message,
        durationMs: duration,
      });

      return {
        tableName: 'audit_logs',
        deletedCount: 0,
        durationMs: duration,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // ARTIFACTS CLEANUP (WI-021)
  // ============================================================================

  async cleanupArtifacts(): Promise<CleanupResult> {
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      // 1. Clean up expired artifacts with grace period
      const expiredArtifacts = await this.cleanupExpiredArtifacts();
      totalDeleted += expiredArtifacts.length;

      // 2. Clean up soft-deleted artifacts beyond retention
      const softDeletedCount = await this.cleanupSoftDeletedArtifacts();
      totalDeleted += softDeletedCount;

      const duration = Date.now() - startTime;

      // Record metrics
      cleanupMetrics.deletedRowsTotal
        .labels({ table_name: validateCleanupTableName('artifact_records') })
        .inc(totalDeleted);

      this.logger.log(`Cleaned up ${totalDeleted} artifact records`, {
        expiredDeleted: expiredArtifacts.length,
        softDeleted: softDeletedCount,
        durationMs: duration,
      });

      return {
        tableName: 'artifacts',
        deletedCount: totalDeleted,
        durationMs: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup artifacts`, {
        error: error.message,
        durationMs: duration,
      });

      return {
        tableName: 'artifacts',
        deletedCount: 0,
        durationMs: duration,
        error: error.message,
      };
    }
  }

  private async cleanupExpiredArtifacts(): Promise<ArtifactCleanupResult[]> {
    const graceCutoff = getRetentionCutoff(
      this.retentionConfig.artifacts.expiredGraceDays
    );

    // Find artifacts that have expired and are past the grace period
    const expiredArtifacts = await this.prisma.artifactRecord.findMany({
      where: {
        expiresAt: {
          lt: graceCutoff,
        },
        deletedAt: null, // Not already soft-deleted
      },
      select: {
        id: true,
        tenantId: true,
        objectKey: true,
      },
    });

    const results: ArtifactCleanupResult[] = [];

    for (const artifact of expiredArtifacts) {
      try {
        // Delete from storage first
        const storageResult = await this.deleteStorageObject(
          artifact.tenantId,
          artifact.objectKey
        );

        if (storageResult.deleted) {
          // Storage deletion successful, now delete record
          await this.prisma.artifactRecord.delete({
            where: { id: artifact.id },
          });

          results.push({
            tenantId: artifact.tenantId,
            objectKey: artifact.objectKey,
            deleted: true,
          });
        } else {
          // Storage deletion failed, don't delete record
          results.push({
            tenantId: artifact.tenantId,
            objectKey: artifact.objectKey,
            deleted: false,
            error: storageResult.error,
          });
        }
      } catch (error: any) {
        results.push({
          tenantId: artifact.tenantId,
          objectKey: artifact.objectKey,
          deleted: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  private async cleanupSoftDeletedArtifacts(): Promise<number> {
    const cutoff = getRetentionCutoff(
      this.retentionConfig.artifacts.softDeleteRetentionDays
    );

    const result = await this.prisma.artifactRecord.deleteMany({
      where: {
        deletedAt: {
          lt: cutoff,
        },
        NOT: {
          deletedAt: null,
        },
      },
    });

    return result.count;
  }

  private async deleteStorageObject(
    tenantId: string,
    objectKey: string
  ): Promise<StorageDeleteResult> {
    try {
      await this.storageProvider.deleteObject(tenantId, objectKey);
      return {
        tenantId,
        objectKey,
        deleted: true,
      };
    } catch (error: any) {
      return {
        tenantId,
        objectKey,
        deleted: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // USAGE DATA CLEANUP (WI-009)
  // ============================================================================

  async cleanupUsageData(): Promise<CleanupResult> {
    const startTime = Date.now();
    let totalDeleted = 0;

    try {
      // Delete raw usage events older than retention
      const rawCutoff = getRetentionCutoff(
        this.retentionConfig.usage.rawEventRetentionDays
      );
      const rawResult = await this.prisma.usageEvent.deleteMany({
        where: {
          occurredAt: { lt: rawCutoff },
        },
      });
      totalDeleted += rawResult.count;

      // Delete aggregates older than retention (should be longer than raw events)
      const aggregateCutoff = getRetentionCutoff(
        this.retentionConfig.usage.aggregateRetentionDays
      );
      const aggregateResult = await this.prisma.usageAggregate.deleteMany({
        where: {
          periodEnd: { lt: aggregateCutoff },
        },
      });
      totalDeleted += aggregateResult.count;

      const duration = Date.now() - startTime;

      // Record metrics
      cleanupMetrics.deletedRowsTotal
        .labels({ table_name: validateCleanupTableName('usage_events') })
        .inc(rawResult.count);

      cleanupMetrics.deletedRowsTotal
        .labels({ table_name: validateCleanupTableName('usage_aggregates') })
        .inc(aggregateResult.count);

      this.logger.log(`Cleaned up ${totalDeleted} usage records`, {
        rawEventsDeleted: rawResult.count,
        aggregatesDeleted: aggregateResult.count,
        durationMs: duration,
      });

      return {
        tableName: 'usage_data',
        deletedCount: totalDeleted,
        durationMs: duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      this.logger.error(`Failed to cleanup usage data`, {
        error: error.message,
        durationMs: duration,
      });

      return {
        tableName: 'usage_data',
        deletedCount: 0,
        durationMs: duration,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Execute cleanup with advisory lock (multi-instance safety)
   */
  async executeWithLock<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; lockAcquired: boolean }> {
    const client = this.prisma.$extends({
      client: {
        $queryRaw: this.prisma.$queryRaw,
      },
    });

    try {
      // Try to acquire advisory lock
      const lockResult = await this.prisma.$queryRaw<
        { pg_try_advisory_lock: boolean }[]
      >`
        SELECT pg_try_advisory_lock(${BigInt(0x4e6575726f6e58)}) as pg_try_advisory_lock
      `;

      const lockAcquired = lockResult[0]?.pg_try_advisory_lock === true;

      if (!lockAcquired) {
        this.logger.debug('Cleanup lock not acquired, skipping operation');
        return { result: null as T, lockAcquired: false };
      }

      // Execute operation with lock held
      const result = await operation();

      return { result, lockAcquired: true };
    } finally {
      // Always release the lock
      try {
        await this.prisma.$queryRaw`
          SELECT pg_advisory_unlock(${BigInt(0x4e6575726f6e58)})
        `;
      } catch (unlockError) {
        this.logger.warn('Failed to release cleanup advisory lock', {
          error: (unlockError as Error).message,
        });
      }
    }
  }
}
