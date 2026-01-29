/**
 * Scheduled Snapshot Trigger - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * Cron-based trigger for automated snapshot ingestion.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GhlSnapshotService } from '../ghl-snapshot.service';
import { SnapshotType } from '../snapshot-types';

@Injectable()
export class ScheduledSnapshotTrigger {
  private readonly logger = new Logger(ScheduledSnapshotTrigger.name);
  private activeJobs = new Map<string, boolean>();

  constructor(private readonly snapshotService: GhlSnapshotService) {}

  /**
   * Daily snapshot run - comprehensive update of all GHL configuration
   * Runs at 2 AM daily to avoid peak hours
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyFullSnapshot(): Promise<void> {
    const jobId = `daily_full_${Date.now()}`;
    this.activeJobs.set(jobId, true);

    try {
      this.logger.log('Starting scheduled daily full snapshot run');

      // Get all tenants that need snapshots
      // In a real implementation, this would query the database for active tenants
      const tenants = await this.getActiveTenants();

      for (const { tenantId, ghlAccountId } of tenants) {
        if (!this.activeJobs.get(jobId)) {
          this.logger.warn('Snapshot job cancelled', { jobId, tenantId });
          break;
        }

        const correlationId = `scheduled_daily_${tenantId}_${Date.now()}`;

        try {
          const result = await this.snapshotService.runFullSnapshot(
            tenantId,
            ghlAccountId,
            correlationId
          );

          this.logger.log('Completed daily snapshot for tenant', {
            tenantId,
            ghlAccountId,
            overallSuccess: result.overallSuccess,
            totalSnapshots: result.results.length,
            successfulSnapshots: result.results.filter(r => r.success).length,
            durationMs: result.durationMs,
            correlationId,
          });
        } catch (error) {
          this.logger.error('Failed daily snapshot for tenant', {
            tenantId,
            ghlAccountId,
            error: (error as Error).message,
            correlationId,
          });
        }
      }
    } catch (error) {
      this.logger.error('Scheduled daily snapshot job failed', {
        error: (error as Error).message,
        jobId,
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Hourly incremental snapshots - critical configuration changes
   * Runs every hour for pipelines and workflows (most likely to change)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runHourlyCriticalSnapshots(): Promise<void> {
    const jobId = `hourly_critical_${Date.now()}`;
    this.activeJobs.set(jobId, true);

    try {
      this.logger.log('Starting scheduled hourly critical snapshot run');

      const tenants = await this.getActiveTenants();
      const criticalTypes = [SnapshotType.PIPELINES, SnapshotType.WORKFLOWS];

      for (const { tenantId, ghlAccountId } of tenants) {
        if (!this.activeJobs.get(jobId)) {
          break;
        }

        for (const snapshotType of criticalTypes) {
          const correlationId = `scheduled_hourly_${tenantId}_${snapshotType}_${Date.now()}`;

          try {
            const result = await this.snapshotService.runSingleSnapshot(
              snapshotType,
              tenantId,
              ghlAccountId,
              correlationId
            );

            if (result.success) {
              this.logger.debug('Completed hourly critical snapshot', {
                tenantId,
                ghlAccountId,
                snapshotType,
                recordCount: result.recordCount,
                correlationId,
              });
            } else {
              this.logger.warn('Hourly critical snapshot failed', {
                tenantId,
                ghlAccountId,
                snapshotType,
                errors: result.errors.length,
                correlationId,
              });
            }
          } catch (error) {
            this.logger.error('Failed hourly critical snapshot', {
              tenantId,
              ghlAccountId,
              snapshotType,
              error: (error as Error).message,
              correlationId,
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Scheduled hourly critical snapshot job failed', {
        error: (error as Error).message,
        jobId,
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Weekly comprehensive validation - ensures no configuration drift
   * Runs every Sunday at 3 AM
   */
  @Cron('0 3 * * 0')
  async runWeeklyValidation(): Promise<void> {
    const jobId = `weekly_validation_${Date.now()}`;
    this.activeJobs.set(jobId, true);

    try {
      this.logger.log('Starting scheduled weekly validation snapshot run');

      const tenants = await this.getActiveTenants();

      for (const { tenantId, ghlAccountId } of tenants) {
        if (!this.activeJobs.get(jobId)) {
          break;
        }

        const correlationId = `scheduled_weekly_${tenantId}_${Date.now()}`;

        try {
          const result = await this.snapshotService.runFullSnapshot(
            tenantId,
            ghlAccountId,
            correlationId
          );

          // Perform validation checks on the snapshots
          await this.validateSnapshotConsistency(
            tenantId,
            ghlAccountId,
            result,
            correlationId
          );

          this.logger.log('Completed weekly validation for tenant', {
            tenantId,
            ghlAccountId,
            overallSuccess: result.overallSuccess,
            correlationId,
          });
        } catch (error) {
          this.logger.error('Failed weekly validation for tenant', {
            tenantId,
            ghlAccountId,
            error: (error as Error).message,
            correlationId,
          });
        }
      }
    } catch (error) {
      this.logger.error('Scheduled weekly validation job failed', {
        error: (error as Error).message,
        jobId,
      });
    } finally {
      this.activeJobs.delete(jobId);
    }
  }

  /**
   * Cancel active snapshot jobs
   */
  cancelJob(jobId: string): boolean {
    if (this.activeJobs.has(jobId)) {
      this.activeJobs.set(jobId, false);
      this.logger.warn('Cancelled snapshot job', { jobId });
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
   * Get active tenants (mock implementation)
   * In real implementation, this would query the database for tenants with GHL connections
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
   * Validate snapshot consistency (for weekly validation)
   */
  private async validateSnapshotConsistency(
    tenantId: string,
    ghlAccountId: string,
    snapshotResult: any,
    correlationId: string
  ): Promise<void> {
    // In a real implementation, this would:
    // 1. Check for missing or corrupted snapshots
    // 2. Validate cross-reference consistency (e.g., workflows referencing valid calendars)
    // 3. Check for configuration drift indicators
    // 4. Generate validation reports

    const validationIssues: string[] = [];

    // Example validations
    if (snapshotResult.results.some((r: any) => r.recordCount === 0)) {
      validationIssues.push('Empty snapshot detected');
    }

    if (snapshotResult.results.some((r: any) => r.errors.length > 0)) {
      validationIssues.push('Snapshot errors detected');
    }

    if (validationIssues.length > 0) {
      this.logger.warn('Snapshot validation issues found', {
        tenantId,
        ghlAccountId,
        issues: validationIssues,
        correlationId,
      });
    } else {
      this.logger.log('Snapshot validation passed', {
        tenantId,
        ghlAccountId,
        correlationId,
      });
    }
  }
}
