/**
 * Metrics Collector - WI-024: Observability & Metrics Foundation
 *
 * Periodically collects backlog metrics from database for Prometheus gauges.
 * Includes feature flag control for metrics collection.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';
import {
  outboxMetrics,
  webhookMetrics,
  slaMetrics,
  voiceMetrics,
} from './metrics';
import { OutboxRepository } from '../eventing/outbox.repository';
import { WebhookRepository } from '../webhooks/webhook.repository';
import { SlaTimerRepository } from '../sla/sla-timer.repository';
import { VoiceAttemptRepository } from '../voice/voice-attempt.repository';
import { FeatureFlagsService } from '../config/feature-flags.service';

@Injectable()
export class MetricsCollector {
  private readonly logger = new Logger(MetricsCollector.name);

  constructor(
    private readonly prisma: PrismaClient,
    private readonly outboxRepository: OutboxRepository,
    private readonly webhookRepository: WebhookRepository,
    private readonly slaTimerRepository: SlaTimerRepository,
    private readonly voiceAttemptRepository: VoiceAttemptRepository,
    private readonly featureFlags: FeatureFlagsService
  ) {}

  @Interval(30000) // Every 30 seconds
  async collectBacklogMetrics(): Promise<void> {
    // Check feature flag
    if (!this.featureFlags.isMetricsEnabled()) {
      // Only log once per session, not every 30 seconds
      return;
    }

    try {
      await this.collectOutboxMetrics();
      await this.collectWebhookMetrics();
      await this.collectSlaMetrics();
      await this.collectVoiceMetrics();
    } catch (error: any) {
      this.logger.error('Failed to collect backlog metrics:', error.message);
      // Fail-open: metrics collection must never break business logic
    }
  }

  private async collectOutboxMetrics(): Promise<void> {
    const { pending, processing, deadLetter } =
      await this.outboxRepository.getEventCountsByStatus();
    outboxMetrics.pendingTotal.set(pending);
    outboxMetrics.processingTotal.set(processing);
    outboxMetrics.deadLetterTotal.set(deadLetter);
  }

  private async collectWebhookMetrics(): Promise<void> {
    const { pending, deadLetter } =
      await this.webhookRepository.getDeliveryCountsByStatus();
    webhookMetrics.pendingTotal.set(pending);
    webhookMetrics.deadLetterTotal.set(deadLetter);
  }

  private async collectSlaMetrics(): Promise<void> {
    const dueCount = await this.slaTimerRepository.getDueTimersCount();
    slaMetrics.dueTotal.set(dueCount);
  }

  private async collectVoiceMetrics(): Promise<void> {
    const failedRetryableCount =
      await this.voiceAttemptRepository.getFailedRetryableAttemptsCount();
    voiceMetrics.failedRetryableTotal.set(failedRetryableCount);
  }
}
