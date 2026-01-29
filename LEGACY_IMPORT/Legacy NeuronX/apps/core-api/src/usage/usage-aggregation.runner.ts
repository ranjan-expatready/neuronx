/**
 * Usage Aggregation Runner - WI-009: Usage Persistence
 *
 * Background service for computing usage rollups with multi-instance safety.
 * Uses database advisory locks to prevent concurrent execution across pods.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import { UsageRepository } from './usage.repository';

@Injectable()
export class UsageAggregationRunner {
  private readonly logger = new Logger(UsageAggregationRunner.name);
  private readonly AGGREGATION_LOCK_KEY = 123456789; // Unique advisory lock key
  private isRunning = false;

  constructor(
    private readonly usageRepository: UsageRepository,
    private readonly prisma: PrismaClient
  ) {}

  /**
   * Run aggregation every 10 minutes (adjustable via cron expression)
   * Uses database advisory lock for multi-instance safety
   */
  @Cron('0 */10 * * * *') // Every 10 minutes
  async runAggregation(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Aggregation runner already running, skipping');
      return;
    }

    // Try to acquire advisory lock (non-blocking)
    const lockAcquired = await this.acquireAggregationLock();

    if (!lockAcquired) {
      this.logger.debug('Aggregation lock already held by another instance');
      return;
    }

    this.isRunning = true;

    try {
      const processedTenants = await this.processAllTenants();
      this.logger.log(
        `Completed usage aggregation for ${processedTenants} tenants`
      );
    } catch (error) {
      this.logger.error('Failed to run usage aggregation:', error);
    } finally {
      this.isRunning = false;
      await this.releaseAggregationLock();
    }
  }

  /**
   * Manual trigger for testing or immediate execution
   */
  async runNow(): Promise<number> {
    if (this.isRunning) {
      throw new Error('Aggregation runner is already running');
    }

    const lockAcquired = await this.acquireAggregationLock();
    if (!lockAcquired) {
      throw new Error('Aggregation lock already held by another instance');
    }

    this.isRunning = true;

    try {
      const processedTenants = await this.processAllTenants();
      this.logger.log(
        `Manual aggregation completed for ${processedTenants} tenants`
      );
      return processedTenants;
    } finally {
      this.isRunning = false;
      await this.releaseAggregationLock();
    }
  }

  /**
   * Acquire database advisory lock for aggregation
   */
  private async acquireAggregationLock(): Promise<boolean> {
    try {
      // Try to acquire advisory lock (non-blocking)
      const result = await this.prisma.$queryRaw<{ lock_acquired: boolean }[]>`
        SELECT pg_try_advisory_lock(${this.AGGREGATION_LOCK_KEY}) as lock_acquired
      `;

      return result[0]?.lock_acquired || false;
    } catch (error) {
      this.logger.error('Failed to acquire aggregation lock:', error);
      return false;
    }
  }

  /**
   * Release database advisory lock
   */
  private async releaseAggregationLock(): Promise<void> {
    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${this.AGGREGATION_LOCK_KEY})
      `;
    } catch (error) {
      this.logger.error('Failed to release aggregation lock:', error);
    }
  }

  /**
   * Process aggregation for all tenants
   */
  private async processAllTenants(): Promise<number> {
    // Get all tenants (this could be optimized with pagination for large deployments)
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true },
    });

    let processedCount = 0;

    for (const tenant of tenants) {
      try {
        await this.processTenantAggregation(tenant.id);
        processedCount++;
      } catch (error) {
        this.logger.error(
          `Failed to process aggregation for tenant ${tenant.id}:`,
          error
        );
        // Continue with other tenants
      }
    }

    return processedCount;
  }

  /**
   * Process aggregation for a single tenant
   */
  private async processTenantAggregation(tenantId: string): Promise<void> {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    // Generate rollups for yesterday (complete day) and current day (partial)
    const rollupCount = await this.usageRepository.generateRollups(
      tenantId,
      yesterday,
      now,
      ['daily', 'monthly'] // Generate both daily and monthly rollups
    );

    if (rollupCount > 0) {
      this.logger.debug(
        `Generated ${rollupCount} rollups for tenant ${tenantId}`
      );
    }
  }

  /**
   * Check if runner is currently executing
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get aggregation statistics
   */
  async getAggregationStats(): Promise<{
    isRunning: boolean;
    lastRunTime?: Date;
    lockHeld: boolean;
  }> {
    const lockHeld = await this.checkLockHeld();

    return {
      isRunning: this.isRunning,
      lockHeld,
    };
  }

  /**
   * Check if advisory lock is currently held
   */
  private async checkLockHeld(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRaw<{ lock_held: boolean }[]>`
        SELECT pg_advisory_lock_shared(${this.AGGREGATION_LOCK_KEY}) as lock_held
      `;

      // Release the shared lock we just acquired for checking
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock_shared(${this.AGGREGATION_LOCK_KEY})
      `;

      return !result[0]?.lock_held; // If we got the shared lock, exclusive lock is not held
    } catch (error) {
      this.logger.error('Failed to check lock status:', error);
      return false;
    }
  }
}
