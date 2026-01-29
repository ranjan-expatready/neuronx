/**
 * Scheduled Drift Trigger - WI-053: Drift Detection Engine
 *
 * Cron-based trigger for automated drift detection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GhlDriftDetectionService } from '../ghl-drift-detection.service';
import { SnapshotType } from '../drift-types';

@Injectable()
export class ScheduledDriftTrigger {
  private readonly logger = new Logger(ScheduledDriftTrigger.name);
  private activeJobs = new Map<string, boolean>();

  constructor(private readonly driftService: GhlDriftDetectionService) {}

  /**
   * Daily drift detection - comprehensive analysis of all snapshot types
   * Runs at 3 AM daily, after snapshot ingestion completes
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runDailyDriftDetection(): Promise<void> {
    const jobId = `daily_drift_${Date.now()}`;
    this.activeJobs.set(jobId, true);

    try {
      this.logger.log('Starting scheduled daily drift detection run');

      // Get all tenants that have snapshots
      // In a real implementation, this would query the database for tenants with snapshots
      const tenants = await this.getActiveTenants();

      for (const { tenantId, ghlAccountId } of tenants) {
        if (!this.activeJobs.get(jobId)) {
          this.logger.warn('Drift detection job cancelled', {
            jobId,
            tenantId,
          });
          break;
        }

        const correlationId = `scheduled_daily_drift_${tenantId}_${Date.now()}`;

        try {
          // Run drift detection for all snapshot types
          const results = await Promise.allSettled([
            this.runDriftDetectionForType(
              SnapshotType.LOCATIONS,
              tenantId,
              ghlAccountId,
              correlationId
            ),
            this.runDriftDetectionForType(
              SnapshotType.PIPELINES,
              tenantId,
              ghlAccountId,
              correlationId
            ),
            this.runDriftDetectionForType(
              SnapshotType.WORKFLOWS,
              tenantId,
              ghlAccountId,
              correlationId
            ),
            this.runDriftDetectionForType(
              SnapshotType.CALENDARS,
              tenantId,
              ghlAccountId,
              correlationId
            ),
            this.runDriftDetectionForType(
              SnapshotType.AI_WORKERS,
              tenantId,
              ghlAccountId,
              correlationId
            ),
          ]);

          // Log results
          const successful = results.filter(
            r => r.status === 'fulfilled' && (r as any).value.success
          ).length;
          const failed = results.filter(
            r =>
              r.status === 'rejected' ||
              (r.status === 'fulfilled' && !(r as any).value.success)
          ).length;

          this.logger.log('Completed drift detection for tenant', {
            tenantId,
            ghlAccountId,
            totalTypes: results.length,
            successful,
            failed,
            correlationId,
          });

          // Check for critical drift
          const criticalResults = results
            .filter(r => r.status === 'fulfilled' && (r as any).value.success)
            .map(r => (r as any).value)
            .filter((result: any) => result.driftResult?.summary.hasCriticalChanges);

          if (criticalResults.length > 0) {
            this.logger.warn('Critical drift detected', {
              tenantId,
              ghlAccountId,
              criticalTypes: criticalResults.map(
                r => r.driftResult?.snapshotType
              ),
              correlationId,
            });
          }
        } catch (error) {
          this.logger.error('Failed drift detection for tenant', {
            tenantId,
            ghlAccountId,
            error: error.message,
            correlationId,
          });
        }
      }
    } catch (error) {
      this.logger.error('Scheduled daily drift detection job failed', {
        error: error.message,
        jobId,
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Hourly drift detection for critical changes - pipelines and workflows only
   * Runs every hour for most volatile configurations
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyCriticalDriftDetection(): Promise<void> {
    const jobId = `hourly_critical_drift_${Date.now()}`;
    this.activeJobs.set(jobId, true);

    try {
      this.logger.log('Starting scheduled hourly critical drift detection run');

      const tenants = await this.getActiveTenants();
      const criticalTypes = [
        SnapshotType.PIPELINES,
        SnapshotType.WORKFLOWS,
        SnapshotType.AI_WORKERS,
      ];

      for (const { tenantId, ghlAccountId } of tenants) {
        if (!this.activeJobs.get(jobId)) {
          break;
        }

        for (const snapshotType of criticalTypes) {
          const correlationId = `scheduled_hourly_drift_${tenantId}_${snapshotType}_${Date.now()}`;

          try {
            const result = await this.runDriftDetectionForType(
              snapshotType,
              tenantId,
              ghlAccountId,
              correlationId
            );

            if (
              result.success &&
              result.driftResult?.summary.hasCriticalChanges
            ) {
              this.logger.warn('Critical drift detected in hourly check', {
                tenantId,
                ghlAccountId,
                snapshotType,
                maxSeverity: result.driftResult.summary.maxSeverity,
                correlationId,
              });
            }
          } catch (error) {
            this.logger.error('Failed hourly critical drift detection', {
              tenantId,
              ghlAccountId,
              snapshotType,
              error: error.message,
              correlationId,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error(
        'Scheduled hourly critical drift detection job failed',
        {
          error: error.message,
          jobId,
        }
      );
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Weekly comprehensive drift analysis - ensures no silent drift accumulation
   * Runs every Sunday at 4 AM
   */
  @Cron('0 4 * * 0')
  async runWeeklyDriftAnalysis(): Promise<void> {
    const jobId = `weekly_drift_analysis_${Date.now()}`;
    this.activeJobs.set(jobId, true);

    try {
      this.logger.log('Starting scheduled weekly drift analysis run');

      const tenants = await this.getActiveTenants();

      for (const { tenantId, ghlAccountId } of tenants) {
        if (!this.activeJobs.get(jobId)) {
          break;
        }

        const correlationId = `scheduled_weekly_drift_${tenantId}_${Date.now()}`;

        try {
          // Get drift statistics for the past week
          const stats = await this.driftService.getDriftStats(tenantId);

          // Analyze patterns and log insights
          this.analyzeDriftPatterns(
            tenantId,
            ghlAccountId,
            stats,
            correlationId
          );

          this.logger.log('Completed weekly drift analysis for tenant', {
            tenantId,
            ghlAccountId,
            totalDrifts: stats.totalDrifts,
            criticalDrifts: stats.criticalDriftCount,
            correlationId,
          });
        } catch (error) {
          this.logger.error('Failed weekly drift analysis for tenant', {
            tenantId,
            ghlAccountId,
            error: error.message,
            correlationId,
          });
        }
      }
    } catch (error) {
      this.logger.error('Scheduled weekly drift analysis job failed', {
        error: error.message,
        jobId,
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cancel active drift detection jobs
   */
  cancelJob(jobId: string): boolean {
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.set(jobId, false);
      this.logger.warn('Cancelled drift detection job', { jobId });
      return true;
    }
    return false;
  }

  /**
   * Get active job status
   */
  getActiveJobs(): string[] {
    return Array.from(this.activeJobs.keys());
  }

  /**
   * Run drift detection for a specific type
   */
  private async runDriftDetectionForType(
    snapshotType: SnapshotType,
    tenantId: string,
    ghlAccountId: string,
    correlationId: string
  ): Promise<any> {
    const result = await this.driftService.detectDrift({
      tenantId,
      ghlAccountId,
      snapshotType,
      correlationId,
    });

    return result;
  }

  /**
   * Get active tenants (mock implementation)
   * In real implementation, this would query the database for tenants with recent snapshots
   */
  private async getActiveTenants(): Promise<
    Array<{ tenantId: string; ghlAccountId: string }>
  > {
    // Mock implementation - in real system this would query the database
    return [
      { tenantId: 'tenant_001', ghlAccountId: 'ghl_acc_001' },
      { tenantId: 'tenant_002', ghlAccountId: 'ghl_acc_002' },
    ];
  }

  /**
   * Analyze drift patterns for weekly insights
   */
  private analyzeDriftPatterns(
    tenantId: string,
    ghlAccountId: string,
    stats: any,
    correlationId: string
  ): void {
    // Analyze patterns in drift data
    if (stats.criticalDriftCount > 5) {
      this.logger.warn('High critical drift frequency detected', {
        tenantId,
        ghlAccountId,
        criticalDriftCount: stats.criticalDriftCount,
        recommendation: 'Review configuration management processes',
        correlationId,
      });
    }

    // Check for patterns in drift types
    const highDriftTypes = Object.entries(stats.driftsByType)
      .filter(([_, count]) => (count as number) > 10)
      .map(([type, count]) => ({ type, count }));

    if (highDriftTypes.length > 0) {
      this.logger.log('High drift frequency detected for types', {
        tenantId,
        ghlAccountId,
        highDriftTypes,
        correlationId,
      });
    }
  }
}
