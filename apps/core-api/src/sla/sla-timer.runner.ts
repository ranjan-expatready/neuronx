/**
 * SLA Timer Runner - WI-017: SLA Timer Persistence
 *
 * Cron-based SLA timer processor with multi-instance safety.
 * Claims and processes due SLA timers, executing escalations via outbox.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SlaTimerRepository } from './sla-timer.repository';
import { DurableEventPublisherService } from '../eventing/durable-event-publisher';
import { EscalationService } from './escalation.service';

@Injectable()
export class SlaTimerRunner {
  private readonly logger = new Logger(SlaTimerRunner.name);
  private isRunning = false;

  constructor(
    private readonly slaTimerRepository: SlaTimerRepository,
    private readonly durableEventPublisher: DurableEventPublisherService,
    private readonly escalationService: EscalationService
  ) {}

  /**
   * Process SLA timers every minute
   * Uses database row locking for multi-instance safety
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processSlaTimers(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('SLA timer runner already running, skipping');
      return;
    }

    this.isRunning = true;

    try {
      await this.processDueTimers();
    } catch (error) {
      this.logger.error('Failed to process SLA timers:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing
   */
  async processNow(): Promise<number> {
    if (this.isRunning) {
      throw new Error('SLA timer runner is already running');
    }

    this.isRunning = true;

    try {
      return await this.processDueTimers();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process due SLA timers with multi-instance safety
   */
  private async processDueTimers(): Promise<number> {
    const dueTimers = await this.slaTimerRepository.claimDueTimers(50); // Process in batches

    if (dueTimers.length === 0) {
      return 0;
    }

    this.logger.debug(`Processing ${dueTimers.length} due SLA timers`);

    let processedCount = 0;

    for (const timer of dueTimers) {
      try {
        await this.processTimer(timer);
        processedCount++;
      } catch (error: any) {
        this.logger.error(`Failed to process SLA timer ${timer.id}:`, error);

        // Handle retries and failures
        await this.handleTimerFailure(timer, error.message);
      }
    }

    return processedCount;
  }

  /**
   * Process a single SLA timer
   */
  private async processTimer(timer: any): Promise<void> {
    const {
      id: timerId,
      tenantId,
      leadId,
      escalationSteps,
      correlationId,
    } = timer;

    // Mark timer as DUE (first time processing)
    await this.slaTimerRepository.markTimerCompleted(timerId);

    // Publish SLA timer due event via outbox
    await this.durableEventPublisher.publishAsync({
      tenantId,
      eventId: `sla-timer-due-${timerId}`,
      eventType: 'sla.timer.due',
      payload: {
        timerId,
        leadId,
        tenantId,
        dueAt: timer.dueAt,
        slaWindowMinutes: timer.slaWindowMinutes,
      },
      correlationId,
      idempotencyKey: `sla-timer-due-${timerId}`,
      sourceService: 'sla-timer-runner',
    });

    // Execute escalation steps
    if (escalationSteps && escalationSteps.length > 0) {
      await this.executeEscalations(timer);
    } else {
      this.logger.debug(
        `No escalation steps configured for SLA timer ${timerId}`
      );
    }

    this.logger.debug(`Processed SLA timer: ${timerId}`, {
      tenantId,
      leadId,
      escalationSteps: escalationSteps?.length || 0,
    });
  }

  /**
   * Execute escalation steps for a timer
   */
  private async executeEscalations(timer: any): Promise<void> {
    const {
      id: timerId,
      tenantId,
      leadId,
      escalationSteps,
      correlationId,
    } = timer;

    for (const [index, escalationConfig] of escalationSteps.entries()) {
      const escalationStep = index + 1;

      try {
        // Create escalation event record (idempotent)
        const eventId = await this.slaTimerRepository.createEscalationEvent({
          tenantId,
          leadId,
          timerId,
          escalationStep,
          escalationConfig,
          correlationId,
        });

        // Execute the escalation
        await this.escalationService.handleEscalation(
          tenantId,
          escalationConfig.locationId || 'default',
          leadId,
          `SLA timer due - step ${escalationStep}`,
          correlationId
        );

        // Publish escalation executed event via outbox
        await this.durableEventPublisher.publishAsync({
          tenantId,
          eventId: `sla-escalation-${eventId}`,
          eventType: 'sla.escalation.triggered',
          payload: {
            eventId,
            timerId,
            leadId,
            tenantId,
            escalationStep,
            escalationConfig,
            executedAt: new Date().toISOString(),
          },
          correlationId,
          idempotencyKey: `sla-escalation-${timerId}-${escalationStep}`,
          sourceService: 'sla-timer-runner',
        });

        this.logger.debug(
          `Executed escalation step ${escalationStep} for timer ${timerId}`,
          {
            tenantId,
            leadId,
            correlationId,
          }
        );
      } catch (error: any) {
        this.logger.error(
          `Failed to execute escalation step ${escalationStep} for timer ${timerId}:`,
          error
        );

        // Mark escalation event as failed
        try {
          await this.slaTimerRepository.markEscalationFailed(
            eventId,
            error.message
          );
        } catch (markError) {
          this.logger.error(
            `Failed to mark escalation event as failed: ${eventId}`,
            markError
          );
        }

        // Continue with next escalation step (don't fail the whole timer)
      }
    }

    // Mark timer as escalated if we have escalation steps
    await this.slaTimerRepository.markTimerEscalated(timerId);
  }

  /**
   * Handle timer processing failure with retry logic
   */
  private async handleTimerFailure(timer: any, error: string): Promise<void> {
    const maxAttempts = 3;

    if (timer.attempts >= maxAttempts) {
      // Mark as permanently failed
      await this.slaTimerRepository.markTimerFailed(
        timer.id,
        `Max retries exceeded: ${error}`
      );
      this.logger.error(
        `SLA timer marked as permanently failed after ${maxAttempts} attempts: ${timer.id}`,
        {
          tenantId: timer.tenantId,
          leadId: timer.leadId,
          error,
        }
      );
    } else {
      // Mark as failed - will be retried
      await this.slaTimerRepository.markTimerFailed(timer.id, error);
      this.logger.warn(
        `SLA timer marked for retry (attempt ${timer.attempts + 1}/${maxAttempts}): ${timer.id}`,
        {
          tenantId: timer.tenantId,
          leadId: timer.leadId,
          error,
        }
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
   * Get runner statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    recentTimersProcessed: number;
    activeTimers: number;
    escalatedTimers: number;
  }> {
    // Get stats for all tenants (aggregated)
    const timerStats = await this.slaTimerRepository.getTimerStats();
    const escalationStats = await this.slaTimerRepository.getEscalationStats();

    return {
      isRunning: this.isRunning,
      recentTimersProcessed: timerStats.completed + timerStats.escalated,
      activeTimers: timerStats.active,
      escalatedTimers: timerStats.escalated,
    };
  }
}
