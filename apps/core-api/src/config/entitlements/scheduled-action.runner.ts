/**
 * Scheduled Action Runner - WI-010: Entitlement Persistence
 *
 * Executes due entitlement actions with singleton protection.
 * Handles tier lifecycle enforcement (downgrades, freezes, disables).
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EntitlementRepository } from './entitlement.repository';

@Injectable()
export class ScheduledActionRunner {
  private readonly logger = new Logger(ScheduledActionRunner.name);
  private isRunning = false;

  constructor(private readonly entitlementRepository: EntitlementRepository) {}

  /**
   * Run every minute to check for due actions
   * Uses singleton protection to prevent multiple instances from running simultaneously
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async runDueActions(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Scheduled action runner already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      const executedCount =
        await this.entitlementRepository.executeDueScheduledActions();

      if (executedCount > 0) {
        this.logger.log(
          `Executed ${executedCount} scheduled entitlement actions`
        );
      }
    } catch (error) {
      this.logger.error('Failed to execute scheduled actions:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing or immediate execution
   */
  async executeNow(): Promise<number> {
    if (this.isRunning) {
      throw new Error('Scheduled action runner is already running');
    }

    this.isRunning = true;

    try {
      const executedCount =
        await this.entitlementRepository.executeDueScheduledActions();
      this.logger.log(
        `Manually executed ${executedCount} scheduled entitlement actions`
      );
      return executedCount;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if runner is currently executing
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }
}
