// GHL Webhook Controller - Production webhook processing with rate limiting

import { Controller, Post, Body, Headers, Logger, Req, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { WebhookNormalizer } from '@neuronx/webhooks';
import { config } from '@neuronx/config';
import { RateLimitService } from '../rate-limit/rate-limit.service';

@Controller('integrations/ghl/webhooks')
export class GhlWebhookController {
  private readonly logger = new Logger(GhlWebhookController.name);

  constructor(
    private readonly webhookNormalizer: WebhookNormalizer,
    private readonly rateLimitService: RateLimitService,
  ) {}

  /**
   * Process GHL webhooks with correct security ordering:
   * 1. Signature verification (cheap reject if invalid)
   * 2. Rate limiting (tenant/provider scoped)
   * 3. Business processing
   */
  @Post()
  async processWebhook(
    @Body() payload: any,
    @Headers() headers: Record<string, string>,
    @Req() req: Request,
  ) {
    const requestId = headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    // Extract signature and other headers
    const signature = headers['x-webhook-signature'] || headers['x-signature'];
    const tenantId = headers['x-tenant-id'] || 'default';
    const userAgent = headers['user-agent'];

    this.logger.log('GHL webhook received', {
      requestId,
      tenantId,
      userAgent,
      contentLength: headers['content-length'],
      hasSignature: !!signature,
      eventType: payload?.event,
      operation: 'ghl.webhook.process',
    });

    // STEP 1: Signature verification (cheap reject if invalid)
    if (!signature && !config.SKIP_WEBHOOK_VERIFICATION) {
      this.logger.warn('GHL webhook missing signature', {
        requestId,
        tenantId,
        skipVerification: config.SKIP_WEBHOOK_VERIFICATION,
      });

      throw new UnauthorizedException({
        status: 'skipped',
        reason: 'signature_invalid',
        processingTime: Date.now() - startTime,
      });
    }

    try {
      // Verify signature first (before any expensive operations)
      const result = await this.webhookNormalizer.processWebhook(
        payload,
        signature,
        headers,
        tenantId
      );

      const processingTime = Date.now() - startTime;

      if (!result.processed) {
        // Webhook was not processed (signature invalid, duplicate, etc.)
        const reason = !result.verification?.valid ? 'signature_invalid' :
                      result.replayCheck?.isDuplicate ? 'duplicate_webhook' :
                      'unsupported_event';

        this.logger.warn('GHL webhook processing skipped', {
          requestId,
          tenantId,
          reason,
          verificationError: result.verification?.error,
          processingTime,
          operation: 'ghl.webhook.process',
        });

        if (!result.verification?.valid) {
          // Signature invalid - authentication failure
          throw new UnauthorizedException({
            status: 'skipped',
            reason,
            processingTime,
          });
        } else if (result.replayCheck?.isDuplicate) {
          // Duplicate webhook - return success (idempotent)
          return {
            status: 'skipped',
            reason,
            processingTime,
          };
        } else {
          // Other error - bad request
          throw new BadRequestException({
            status: 'skipped',
            reason,
            processingTime,
          });
        }
      }

      // STEP 2: Rate limiting (only after signature verification passes)
      await this.rateLimitService.enforceWebhookRateLimit({
        req,
        providerId: 'ghl',
      });

      // STEP 3: Business processing (only after signature + rate limit checks pass)
      this.logger.log('GHL webhook processed successfully', {
        requestId,
        tenantId,
        eventType: result.event?.type,
        correlationId: result.event?.metadata.correlationId,
        processingTime,
        operation: 'ghl.webhook.process',
      });

      return {
        status: 'processed',
        eventId: result.event?.metadata.correlationId,
        processingTime,
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      this.logger.error('GHL webhook processing failed', {
        requestId,
        tenantId,
        error: error.message,
        stack: error.stack,
        processingTime,
        operation: 'ghl.webhook.process',
      });

      throw error; // Let NestJS handle the error response
    }
  }
}

