/**
 * Webhook Dispatcher - WI-018: Outbound Webhook Delivery System
 *
 * Cron-based webhook delivery processor with multi-instance safety.
 * Claims pending deliveries, sends HTTP requests, and handles retries.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WebhookRepository } from './webhook.repository';
import { WebhookSigner } from './webhook.signer';
import { WebhookPayload, WebhookDeliveryResult } from './webhook.types';
import { webhookMetrics } from '../observability/metrics';
import { FeatureFlagsService } from '../config/feature-flags.service';
import { ReadinessGuardService } from '../config/readiness-guard.service';

@Injectable()
export class WebhookDispatcher {
  private readonly logger = new Logger(WebhookDispatcher.name);
  private isRunning = false;

  constructor(
    private readonly webhookRepository: WebhookRepository,
    private readonly webhookSigner: WebhookSigner,
    private readonly featureFlags: FeatureFlagsService,
    private readonly readinessGuard: ReadinessGuardService
  ) {}

  /**
   * Process webhook deliveries every minute
   * Uses database row locking for multi-instance safety
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async processWebhookDeliveries(): Promise<void> {
    if (this.isRunning) {
      this.logger.debug('Webhook dispatcher already running, skipping');
      return;
    }

    // Check feature flag
    if (!this.featureFlags.isWebhookProcessingEnabled()) {
      this.featureFlags.logFeatureDisabled(
        'webhookProcessingEnabled',
        'processWebhookDeliveries cron'
      );
      return;
    }

    // Check system readiness
    const shouldRun =
      await this.readinessGuard.shouldRunBackgroundJob('webhook-dispatcher');
    if (!shouldRun) {
      this.logger.debug('Skipping webhook processing: system not ready');
      return;
    }

    this.isRunning = true;

    try {
      await this.processPendingDeliveries();
    } catch (error) {
      this.logger.error('Failed to process webhook deliveries:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Manual trigger for testing
   */
  async processNow(): Promise<number> {
    if (this.isRunning) {
      throw new Error('Webhook dispatcher is already running');
    }

    this.isRunning = true;

    try {
      return await this.processPendingDeliveries();
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process pending webhook deliveries with multi-instance safety
   */
  private async processPendingDeliveries(): Promise<number> {
    // Step 1: Fanout - create deliveries for published outbox events
    await this.webhookRepository.createDeliveriesForPublishedEvents();

    // Step 2: Claim pending deliveries for processing
    const deliveries = await this.webhookRepository.claimPendingDeliveries(50); // Process in batches

    if (deliveries.length === 0) {
      return 0;
    }

    this.logger.debug(`Processing ${deliveries.length} webhook deliveries`);

    let processedCount = 0;

    for (const delivery of deliveries) {
      try {
        await this.processDelivery(delivery);
        processedCount++;
      } catch (error: any) {
        this.logger.error(
          `Failed to process webhook delivery ${delivery.id}:`,
          error
        );

        // Handle retries and failures
        await this.handleDeliveryFailure(delivery, error.message);
      }
    }

    return processedCount;
  }

  /**
   * Process a single webhook delivery
   */
  private async processDelivery(delivery: any): Promise<void> {
    const {
      id: deliveryId,
      tenantId,
      endpointId,
      outboxEventId,
      outboxEventType,
      correlationId,
      attempts,
    } = delivery;

    // Get endpoint configuration
    const endpoint = await this.webhookRepository.getEndpointById(
      tenantId,
      endpointId
    );
    if (!endpoint) {
      throw new Error(`Webhook endpoint ${endpointId} not found`);
    }

    // Get outbox event payload
    const outboxEvent = await this.getOutboxEvent(outboxEventId);
    if (!outboxEvent) {
      throw new Error(`Outbox event ${outboxEventId} not found`);
    }

    // Create webhook payload
    const webhookPayload: WebhookPayload = {
      eventType: outboxEventType,
      eventId: outboxEvent.eventId,
      occurredAt: outboxEvent.createdAt.toISOString(),
      payload: outboxEvent.payload,
      tenantId,
      correlationId: correlationId || undefined,
      deliveryId,
      attemptNumber: attempts,
    };

    // Send HTTP request
    const result = await this.sendWebhookRequest(
      endpoint,
      webhookPayload,
      deliveryId
    );

    // Record attempt
    await this.webhookRepository.recordAttempt(
      tenantId,
      deliveryId,
      attempts,
      result
    );

    // Handle result
    if (
      result.success &&
      result.statusCode &&
      result.statusCode >= 200 &&
      result.statusCode < 300
    ) {
      // Success
      await this.webhookRepository.markDelivered(tenantId, deliveryId);

      // Record success metrics
      webhookMetrics.deliverySuccessTotal.inc();
      webhookMetrics.deliveryDurationMs.observe(result.durationMs);

      this.logger.debug(`Successfully delivered webhook: ${deliveryId}`, {
        tenantId,
        endpointId,
        outboxEventId,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
      });
    } else {
      // Failure - will be retried or marked dead letter
      const errorMsg = result.error || `HTTP ${result.statusCode || 'unknown'}`;
      throw new Error(errorMsg);
    }
  }

  /**
   * Send HTTP webhook request with signing
   */
  private async sendWebhookRequest(
    endpoint: any,
    payload: WebhookPayload,
    deliveryId: string
  ): Promise<WebhookDeliveryResult> {
    const startTime = Date.now();

    try {
      // Create signed headers using secret reference
      const secretRef = endpoint.secretRef;
      if (!secretRef) {
        throw new Error(
          `No secret reference configured for endpoint ${endpoint.id}`
        );
      }

      const { headers } = await this.webhookSigner.createSignedHeaders(
        payload,
        secretRef,
        deliveryId
      );

      // Send HTTP request
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        endpoint.timeoutMs
      );

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text();

      return {
        success: response.ok,
        statusCode: response.status,
        responseBody:
          responseBody.length > 2048
            ? responseBody.substring(0, 2048) + '...'
            : responseBody,
        durationMs,
      };
    } catch (error: any) {
      const durationMs = Date.now() - startTime;

      if (error.name === 'AbortError') {
        return {
          success: false,
          durationMs,
          error: `Request timeout after ${endpoint.timeoutMs}ms`,
        };
      }

      return {
        success: false,
        durationMs,
        error: error.message,
      };
    }
  }

  /**
   * Handle delivery processing failure with retry logic
   */
  private async handleDeliveryFailure(
    delivery: any,
    error: string
  ): Promise<void> {
    const { tenantId, id: deliveryId, endpointId } = delivery;

    // Get endpoint to check max attempts
    const endpoint = await this.webhookRepository.getEndpointById(
      tenantId,
      endpointId
    );
    const maxAttempts = endpoint?.maxAttempts || 10;

    if (delivery.attempts >= maxAttempts) {
      // Max retries exceeded - mark as dead letter
      await this.webhookRepository.markDeadLetter(tenantId, deliveryId, error);

      // Record failure metrics
      webhookMetrics.deliveryFailTotal.inc();

      this.logger.error(
        `Webhook delivery marked as dead letter after ${maxAttempts} attempts: ${deliveryId}`,
        {
          tenantId,
          endpointId,
          error,
        }
      );
    } else {
      // Mark as failed - will be retried
      await this.webhookRepository.markFailed(tenantId, deliveryId, error);

      // Record failure metrics (will be retried)
      webhookMetrics.deliveryFailTotal.inc();

      this.logger.warn(
        `Webhook delivery marked for retry (attempt ${delivery.attempts}/${maxAttempts}): ${deliveryId}`,
        {
          tenantId,
          endpointId,
          error,
        }
      );
    }
  }

  /**
   * Get outbox event by ID
   */
  private async getOutboxEvent(outboxEventId: string): Promise<any | null> {
    // Use raw query or repository method to get outbox event
    // For now, using direct Prisma access (could be moved to OutboxRepository)
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      const event = await prisma.outboxEvent.findUnique({
        where: { id: outboxEventId },
      });

      return event;
    } finally {
      await prisma.$disconnect();
    }
  }

  /**
   * Check if dispatcher is currently executing
   */
  isCurrentlyRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get dispatcher statistics
   */
  async getStats(): Promise<{
    isRunning: boolean;
    recentDeliveriesProcessed: number;
    pendingDeliveries: number;
    failedDeliveries: number;
  }> {
    const stats = await this.webhookRepository.getDeliveryStats();

    return {
      isRunning: this.isRunning,
      recentDeliveriesProcessed: stats.delivered + stats.deadLetter,
      pendingDeliveries: stats.pending,
      failedDeliveries: stats.failed,
    };
  }
}
