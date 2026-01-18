/**
 * Outbox Dispatcher - WI-014: Durable Event Streaming
 *
 * Processes outbox events and publishes them to external transports.
 * Uses database row locking for multi-instance safety.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { OutboxRepository, PendingOutboxEvent } from './outbox.repository';
import { outboxMetrics } from '../observability/metrics';
import { FeatureFlagsService } from '../config/feature-flags.service';
import { ReadinessGuardService } from '../config/readiness-guard.service';

export interface EventTransport {
  publish(event: PendingOutboxEvent): Promise<void>;
}

export interface NoopEventTransport extends EventTransport {
  // No-op transport for development/testing
}

@Injectable()
export class NoopEventTransport implements NoopEventTransport {
  private readonly logger = new Logger(NoopEventTransport.name);

  async publish(event: PendingOutboxEvent): Promise<void> {
    this.logger.debug(`No-op transport: ${event.eventType}`, {
      eventId: event.eventId,
      tenantId: event.tenantId,
    });

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}

@Injectable()
export class OutboxDispatcher {
  private readonly logger = new Logger(OutboxDispatcher.name);
  private isRunning = false;

  constructor(
    private readonly outboxRepository: OutboxRepository,
    @Inject('EventTransport')
    private readonly eventTransport: EventTransport,
    private readonly featureFlags: FeatureFlagsService,
    private readonly readinessGuard: ReadinessGuardService
  ) {}

  /**
   * Process outbox events every 5 seconds
   * Uses database row locking for multi-instance safety
   */
  @Cron('*/5 * * * * *') // Every 5 seconds
  async processOutbox(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Outbox dispatcher already running, skipping');
      return;
    }

    // Check feature flag
    if (!this.featureFlags.isOutboxProcessingEnabled()) {
      this.featureFlags.logFeatureDisabled(
        'outboxProcessingEnabled',
        'processOutbox cron'
      );
      return;
    }

    // Check system readiness
    const shouldRun =
      await this.readinessGuard.shouldRunBackgroundJob('outbox-dispatcher');
    if (!shouldRun) {
      this.logger.debug('Skipping outbox processing: system not ready');
      return;
    }

    this.isRunning = true;

    try {
      await this.processPendingEvents();
    } catch (error) {
      this.logger.error('Failed to process outbox events:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing
   */
  async processNow(): Promise<number> {
    if (this.isRunning) {
      throw new Error('Outbox dispatcher is already running');
    }

    this.isRunning = true;

    try {
      return await this.processPendingEvents();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process pending events with multi-instance safety
   */
  private async processPendingEvents(): Promise<number> {
    const events = await this.outboxRepository.claimPendingEvents(10); // Process in batches

    if (events.length === 0) {
      return 0;
    }

    this.logger.debug(`Processing ${events.length} outbox events`);

    let processedCount = 0;

    for (const event of events) {
      try {
        await this.processEvent(event);
        processedCount++;
      } catch (error: any) {
        this.logger.error(`Failed to process outbox event ${event.id}:`, error);

        // Handle retries and dead lettering
        await this.handleEventFailure(event, error.message);
      }
    }

    return processedCount;
  }

  /**
   * Process a single event
   */
  private async processEvent(event: PendingOutboxEvent): Promise<void> {
    const startTime = Date.now();

    try {
      // Publish to external transport
      await this.eventTransport.publish(event);

      // Mark as published
      await this.outboxRepository.markPublished(event.id);

      // Record success metrics
      outboxMetrics.publishSuccessTotal.inc();
      outboxMetrics.dispatchDurationMs.observe(Date.now() - startTime);

      this.logger.debug(`Successfully published event: ${event.eventType}`, {
        eventId: event.eventId,
        tenantId: event.tenantId,
      });
    } catch (error: any) {
      // Record failure metrics
      outboxMetrics.publishFailTotal.inc();
      outboxMetrics.dispatchDurationMs.observe(Date.now() - startTime);

      throw new Error(`Transport publish failed: ${error.message}`);
    }
  }

  /**
   * Handle event processing failure with retry logic
   */
  private async handleEventFailure(
    event: PendingOutboxEvent,
    error: string
  ): Promise<void> {
    const maxAttempts = 5;

    if (event.attempts >= maxAttempts) {
      // Max retries exceeded - mark as dead letter
      await this.outboxRepository.markDeadLetter(event.id, error);
      this.logger.error(
        `Event marked as dead letter after ${maxAttempts} attempts: ${event.id}`,
        {
          eventType: event.eventType,
          tenantId: event.tenantId,
          error,
        }
      );
    } else {
      // Mark as failed - will be retried
      await this.outboxRepository.markFailed(event.id, error);
      this.logger.warn(
        `Event marked for retry (attempt ${event.attempts + 1}/${maxAttempts}): ${event.id}`,
        {
          eventType: event.eventType,
          tenantId: event.tenantId,
          error,
        }
      );
    }
  }

  /**
   * Check if dispatcher is currently running
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get dispatcher statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    transportType: string;
    recentEvents: number;
  }> {
    const stats = await this.outboxRepository.getEventStats();

    return {
      isRunning: this.isRunning,
      transportType: this.eventTransport.constructor.name,
      recentEvents: stats.published,
    };
  }
}
