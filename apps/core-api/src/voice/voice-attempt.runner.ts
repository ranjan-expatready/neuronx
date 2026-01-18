/**
 * Voice Attempt Runner - WI-013: Voice State Persistence
 *
 * Cron-based voice attempt retry processor with multi-instance safety.
 * Claims and retries failed voice attempts, publishes events via outbox.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { VoiceAttemptRepository } from './voice-attempt.repository';
import { DurableEventPublisherService } from '../eventing/durable-event-publisher';
import { FeatureFlagsService } from '../config/feature-flags.service';
import { ReadinessGuardService } from '../config/readiness-guard.service';

@Injectable()
export class VoiceAttemptRunner {
  private readonly logger = new Logger(VoiceAttemptRunner.name);
  private isRunning = false;

  constructor(
    private readonly voiceAttemptRepository: VoiceAttemptRepository,
    private readonly durableEventPublisher: DurableEventPublisherService,
    private readonly featureFlags: FeatureFlagsService,
    private readonly readinessGuard: ReadinessGuardService
  ) {}

  /**
   * Process failed voice attempts every minute
   * Uses database row locking for multi-instance safety
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processFailedAttempts(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Voice attempt runner already running, skipping');
      return;
    }

    // Check feature flag
    if (!this.featureFlags.isVoiceRetryEnabled()) {
      this.featureFlags.logFeatureDisabled(
        'voiceRetryEnabled',
        'processFailedAttempts cron'
      );
      return;
    }

    // Check system readiness
    const shouldRun =
      await this.readinessGuard.shouldRunBackgroundJob('voice-runner');
    if (!shouldRun) {
      this.logger.debug('Skipping voice retry processing: system not ready');
      return;
    }

    this.isRunning = true;

    try {
      await this.retryFailedAttempts();
    } catch (error) {
      this.logger.error('Failed to process voice attempts:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing
   */
  async processNow(): Promise<number> {
    if (this.isRunning) {
      throw new Error('Voice attempt runner is already running');
    }

    this.isRunning = true;

    try {
      return await this.retryFailedAttempts();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Retry failed voice attempts with multi-instance safety
   */
  private async retryFailedAttempts(): Promise<number> {
    const failedAttempts =
      await this.voiceAttemptRepository.claimRetryableAttempts(50); // Process in batches

    if (failedAttempts.length === 0) {
      return 0;
    }

    this.logger.debug(
      `Processing ${failedAttempts.length} failed voice attempts for retry`
    );

    let processedCount = 0;

    for (const attempt of failedAttempts) {
      try {
        await this.retryAttempt(attempt);
        processedCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to retry voice attempt ${attempt.attemptId}:`,
          error
        );

        // Mark as permanently failed after max retries
        await this.voiceAttemptRepository.markFailed(
          attempt.tenantId,
          attempt.attemptId,
          `Retry failed: ${error.message}`
        );
      }
    }

    return processedCount;
  }

  /**
   * Retry a single voice attempt
   */
  private async retryAttempt(attempt: any): Promise<void> {
    const { tenantId, attemptId, leadId, intentType, correlationId, provider } =
      attempt;

    // Publish retry event via outbox
    await this.durableEventPublisher.publishAsync({
      tenantId,
      eventId: `voice-retry-${attemptId}-${Date.now()}`,
      eventType: 'voice.attempt.retry',
      payload: {
        attemptId,
        leadId,
        intentType,
        provider,
        retryAttempt: attempt.attempts,
        maxRetries: attempt.maxRetries,
      },
      correlationId,
      idempotencyKey: `voice-retry-${attemptId}-${attempt.attempts}`,
      sourceService: 'voice-attempt-runner',
    });

    // For now, just mark as failed again - in production this would
    // attempt to re-queue the voice call with the provider
    // This preserves the WI-004 boundary: retries are NeuronX-owned
    await this.voiceAttemptRepository.markFailed(
      tenantId,
      attemptId,
      `Retry attempt ${attempt.attempts} of ${attempt.maxRetries}`
    );

    this.logger.debug(`Retried voice attempt: ${attemptId}`, {
      tenantId,
      retryAttempt: attempt.attempts,
      maxRetries: attempt.maxRetries,
    });
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
    recentAttemptsProcessed: number;
    failedAttempts: number;
    retryableAttempts: number;
  }> {
    const stats = await this.voiceAttemptRepository.getAttemptStats();

    return {
      isRunning: this.isRunning,
      recentAttemptsProcessed: stats.completed + stats.failed,
      failedAttempts: stats.failed,
      retryableAttempts: stats.failed, // Simplified - could be more sophisticated
    };
  }
}
