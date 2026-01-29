/**
 * GHL Billing Webhook Controller - WI-041
 *
 * Handles GHL billing webhooks and syncs entitlement state.
 * Read-only adapter that consumes billing events from GHL.
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { GhlBillingEventNormalizer } from './event-normalizer';
import { EntitlementSyncService } from './entitlement-sync.service';
import { GhlWebhookPayload } from './types';

@Controller('webhooks/ghl-billing')
export class GhlBillingWebhookController {
  private readonly logger = new Logger(GhlBillingWebhookController.name);

  constructor(
    private readonly eventNormalizer: GhlBillingEventNormalizer,
    private readonly syncService: EntitlementSyncService
  ) {}

  /**
   * Process GHL billing webhooks
   *
   * IMPORTANT: This is fire-and-forget processing.
   * We never block or fail the webhook response.
   * Billing sync is eventual, not synchronous.
   */
  @Post()
  async processBillingWebhook(
    @Body() payload: GhlWebhookPayload,
    @Headers() headers: Record<string, string>
  ) {
    const startTime = Date.now();
    const requestId =
      headers['x-request-id'] || `billing_webhook_${Date.now()}`;

    try {
      this.logger.log('GHL billing webhook received', {
        requestId,
        eventType: payload.event?.type,
        eventId: payload.event?.id,
      });

      // Extract tenant ID from headers (set by reverse proxy or auth)
      const tenantId = headers['x-tenant-id'];

      if (!tenantId) {
        this.logger.warn('Missing tenant ID in webhook headers', { requestId });
        // Still return success - don't fail the webhook
        return { status: 'ignored', reason: 'missing_tenant_id' };
      }

      // Normalize the event
      const normalizedEvent = this.eventNormalizer.normalizeEvent(
        payload,
        tenantId
      );

      if (!normalizedEvent) {
        this.logger.debug('Event not processed (unsupported type or invalid)', {
          requestId,
          eventType: payload.event?.type,
        });
        return { status: 'ignored', reason: 'unsupported_event' };
      }

      // Check idempotency
      const alreadyProcessed = await this.syncService.isEventProcessed(
        normalizedEvent.eventId
      );

      if (alreadyProcessed) {
        this.logger.debug('Event already processed', {
          requestId,
          eventId: normalizedEvent.eventId,
        });
        return { status: 'ignored', reason: 'already_processed' };
      }

      // Process the event asynchronously (fire-and-forget)
      this.processEventAsync(normalizedEvent, requestId).catch(error => {
        this.logger.error('Async billing sync failed', {
          requestId,
          eventId: normalizedEvent.eventId,
          error: error.message,
        });
      });

      const processingTime = Date.now() - startTime;

      this.logger.log('GHL billing webhook queued for processing', {
        requestId,
        eventId: normalizedEvent.eventId,
        eventType: normalizedEvent.eventType,
        processingTime,
      });

      // Always return success to GHL - we handle failures asynchronously
      return {
        status: 'accepted',
        eventId: normalizedEvent.eventId,
        processingTime,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('GHL billing webhook processing failed', {
        requestId,
        error: error.message,
        processingTime,
      });

      // Return success anyway - don't fail the webhook
      // Log the error for investigation
      return {
        status: 'accepted_with_error',
        error: error.message,
        processingTime,
      };
    }
  }

  /**
   * Process billing event asynchronously
   */
  private async processEventAsync(
    event: any,
    requestId: string
  ): Promise<void> {
    try {
      const result = await this.syncService.syncBillingEvent(event);

      this.logger.log('Billing sync completed successfully', {
        requestId,
        eventId: event.eventId,
        tenantId: result.tenantId,
        billingStatus: result.billingStatus,
        planTier: result.planTier,
        changed: result.changed,
      });
    } catch (error) {
      this.logger.error('Billing sync failed asynchronously', {
        requestId,
        eventId: event.eventId,
        tenantId: event.tenantId,
        error: error.message,
      });

      // In production, you might want to:
      // - Send alert to engineering team
      // - Queue for retry
      // - Update monitoring metrics

      throw error; // Re-throw to be caught by caller
    }
  }
}
