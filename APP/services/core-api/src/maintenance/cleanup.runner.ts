/**
 * Cleanup Runner - WI-023: Data Retention & Cleanup Runners
 *
 * Cron-scheduled cleanup operations with multi-instance safety.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CleanupRepository } from './cleanup.repository';
import { RetentionConfig } from './retention.config';
import {
  CleanupResult,
  CleanupRunResult,
  CleanupPriority,
} from './cleanup.types';
import {
  cleanupMetrics,
  validateCleanupTableName,
} from '../observability/metrics';
import { FeatureFlagsService } from '../config/feature-flags.service';
import { ReadinessGuardService } from '../config/readiness-guard.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CleanupRunner {
  private readonly logger = new Logger(CleanupRunner.name);
  private isRunning = false;

  constructor(
    private readonly cleanupRepository: CleanupRepository,
    private readonly retentionConfig: RetentionConfig,
    private readonly featureFlags: FeatureFlagsService,
    private readonly readinessGuard: ReadinessGuardService
  ) {}

  // ============================================================================
  // CRON SCHEDULING
  // ============================================================================

  /**
   * Daily cleanup run at 2 AM UTC
   * Runs all cleanup operations in priority order
   */
  @Cron('0 2 * * *', {
    name: 'daily-cleanup',
    timeZone: 'UTC',
  })
  async runDailyCleanup(): Promise<void> {
    // Check feature flag
    if (!this.featureFlags.isCleanupEnabled()) {
      this.featureFlags.logFeatureDisabled(
        'cleanupEnabled',
        'runDailyCleanup cron'
      );
      return;
    }

    // Check system readiness
    const shouldRun =
      await this.readinessGuard.shouldRunBackgroundJob('cleanup-runner');
    if (!shouldRun) {
      this.logger.debug(`Skipping daily cleanup: system not ready`);
      return;
    }

    await this.runCleanup('daily-cleanup');
  }

  /**
   * Hourly cleanup run (lighter operations)
   * Only runs audit logs and outbox cleanup
   */
  @Cron('0 * * * *', {
    name: 'hourly-cleanup',
    timeZone: 'UTC',
  })
  async runHourlyCleanup(): Promise<void> {
    // Check feature flag
    if (!this.featureFlags.isCleanupEnabled()) {
      this.featureFlags.logFeatureDisabled(
        'cleanupEnabled',
        'runHourlyCleanup cron'
      );
      return;
    }

    // Check system readiness
    const shouldRun =
      await this.readinessGuard.shouldRunBackgroundJob('cleanup-runner');
    if (!shouldRun) {
      this.logger.debug(`Skipping hourly cleanup: system not ready`);
      return;
    }

    await this.runCleanup('hourly-cleanup', ['audit_logs', 'outbox_events']);
  }

  /**
   * Manual trigger for testing and operations
   */
  async runManualCleanup(tableNames?: string[]): Promise<CleanupRunResult> {
    return this.runCleanup('manual-cleanup', tableNames);
  }

  // ============================================================================
  // CLEANUP EXECUTION
  // ============================================================================

  private async runCleanup(
    runName: string,
    tableFilter?: string[]
  ): Promise<CleanupRunResult> {
    const runId = uuidv4();
    const startTime = new Date();

    // Prevent concurrent runs
    if (this.isRunning) {
      // Record lock skipped metrics
      cleanupMetrics.lockSkippedTotal.inc();

      this.logger.warn(`Cleanup ${runName} already running, skipping`, {
        runId,
      });
      return this.createSkippedResult(runId, startTime, `Already running`);
    }

    this.isRunning = true;

    // Record run metrics
    cleanupMetrics.runTotal.inc();

    this.logger.log(`Starting cleanup run: ${runName}`, { runId });

    try {
      // Execute cleanup with advisory lock
      const lockResult = await this.cleanupRepository.executeWithLock(
        async () => {
          return await this.executeCleanupOperations(runId, tableFilter);
        }
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const result: CleanupRunResult = {
        runId,
        startTime,
        endTime,
        durationMs: duration,
        lockAcquired: lockResult.lockAcquired,
        results: lockResult.result || [],
        totalDeleted:
          lockResult.result?.reduce((sum, r) => sum + r.deletedCount, 0) || 0,
        errors:
          lockResult.result
            ?.filter(r => r.error)
            .map(r => `${r.tableName}: ${r.error}`) || [],
      };

      // Record duration metrics
      cleanupMetrics.durationMs.observe(duration);

      // Record error metrics
      const errorCount = result.errors.length;
      if (errorCount > 0) {
        result.results.forEach(r => {
          if (r.error) {
            try {
              const tableName = validateCleanupTableName(r.tableName);
              cleanupMetrics.errorsTotal
                .labels({ table_name: tableName })
                .inc();
            } catch {
              // Invalid table name, skip metrics
            }
          }
        });
      }

      this.logCleanupResult(runName, result);
      return result;
    } catch (error: any) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      this.logger.error(`Cleanup run ${runName} failed`, {
        runId,
        error: error.message,
        durationMs: duration,
      });

      return {
        runId,
        startTime,
        endTime,
        durationMs: duration,
        lockAcquired: false,
        results: [],
        totalDeleted: 0,
        errors: [error.message],
      };
    } finally {
      this.isRunning = false;
    }
  }

  private async executeCleanupOperations(
    runId: string,
    tableFilter?: string[]
  ): Promise<CleanupResult[]> {
    const operations = this.getCleanupOperations();
    const filteredOperations = tableFilter
      ? operations.filter(op => tableFilter.includes(op.tableName))
      : operations;

    // Sort by priority
    filteredOperations.sort((a, b) => a.priority - b.priority);

    const results: CleanupResult[] = [];
    const maxRuntime =
      this.retentionConfig.execution.maxRuntimeMinutes * 60 * 1000;
    const startTime = Date.now();

    for (const operation of filteredOperations) {
      // Check if we've exceeded max runtime
      if (Date.now() - startTime > maxRuntime) {
        this.logger.warn(`Cleanup run exceeded max runtime, stopping`, {
          runId,
          maxRuntimeMinutes: this.retentionConfig.execution.maxRuntimeMinutes,
          processedTables: results.length,
        });
        break;
      }

      try {
        this.logger.debug(`Running cleanup for ${operation.tableName}`, {
          runId,
        });
        const result = await operation.execute();
        results.push(result);
      } catch (error: any) {
        this.logger.error(
          `Cleanup operation failed for ${operation.tableName}`,
          {
            runId,
            error: error.message,
          }
        );

        results.push({
          tableName: operation.tableName,
          deletedCount: 0,
          durationMs: 0,
          error: error.message,
        });
      }
    }

    return results;
  }

  private getCleanupOperations(): Array<{
    tableName: string;
    priority: CleanupPriority;
    execute: () => Promise<CleanupResult>;
  }> {
    return [
      {
        tableName: 'outbox_events',
        priority: CleanupPriority.OUTBOX,
        execute: () => this.cleanupRepository.cleanupOutboxEvents(),
      },
      {
        tableName: 'webhook_deliveries',
        priority: CleanupPriority.WEBHOOKS,
        execute: () => this.cleanupRepository.cleanupWebhookDeliveries(),
      },
      {
        tableName: 'audit_logs',
        priority: CleanupPriority.AUDIT,
        execute: () => this.cleanupRepository.cleanupAuditLogs(),
      },
      {
        tableName: 'artifacts',
        priority: CleanupPriority.ARTIFACTS,
        execute: () => this.cleanupRepository.cleanupArtifacts(),
      },
      {
        tableName: 'usage_data',
        priority: CleanupPriority.USAGE,
        execute: () => this.cleanupRepository.cleanupUsageData(),
      },
    ];
  }

  // ============================================================================
  // RESULT LOGGING
  // ============================================================================

  private logCleanupResult(runName: string, result: CleanupRunResult): void {
    const successCount = result.results.filter(r => !r.error).length;
    const errorCount = result.errors.length;

    if (errorCount > 0) {
      this.logger.warn(`Cleanup run ${runName} completed with errors`, {
        runId: result.runId,
        lockAcquired: result.lockAcquired,
        totalDeleted: result.totalDeleted,
        tablesProcessed: result.results.length,
        successfulOperations: successCount,
        failedOperations: errorCount,
        durationMs: result.durationMs,
        errors: result.errors,
      });
    } else {
      this.logger.log(`Cleanup run ${runName} completed successfully`, {
        runId: result.runId,
        lockAcquired: result.lockAcquired,
        totalDeleted: result.totalDeleted,
        tablesProcessed: result.results.length,
        durationMs: result.durationMs,
        tableBreakdown: result.results.map(r => ({
          table: r.tableName,
          deleted: r.deletedCount,
          duration: r.durationMs,
          error: r.error,
        })),
      });
    }
  }

  private createSkippedResult(
    runId: string,
    startTime: Date,
    reason: string
  ): CleanupRunResult {
    const endTime = new Date();

    return {
      runId,
      startTime,
      endTime,
      durationMs: endTime.getTime() - startTime.getTime(),
      lockAcquired: false,
      results: [
        {
          tableName: 'all',
          deletedCount: 0,
          durationMs: 0,
          skipped: true,
        },
      ],
      totalDeleted: 0,
      errors: [],
    };
  }

  // ============================================================================
  // HEALTH CHECKS
  // ============================================================================

  /**
   * Check if cleanup runner is healthy
   */
  isHealthy(): boolean {
    return !this.isRunning;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      retentionConfig: this.retentionConfig,
    };
  }
}
