/**
 * Payment Webhook Controller - REQ-001: External Payment Verification
 *
 * Handles external payment provider webhooks with cryptographic verification.
 * Webhooks can ONLY submit payment evidence - they cannot directly change business state.
 * All evidence is forwarded to PaymentService for independent verification.
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  BadRequestException,
  UnauthorizedException,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { PaymentService } from '../payment.service';
import {
  IPaymentProvider,
  WebhookVerificationResult,
  PaymentVerificationRequest,
} from '../providers/payment-provider.interface';
import { stripePaymentProvider } from '../providers/stripe.provider';
import { RateLimitService } from '../../rate-limit/rate-limit.service';

@Controller('payments/webhooks')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  // Map provider IDs to provider implementations
  private readonly providers = new Map<string, IPaymentProvider>([
    ['stripe', stripePaymentProvider],
  ]);

  constructor(
    private readonly paymentService: PaymentService,
    private readonly rateLimitService: RateLimitService
  ) {}

  /**
   * Handle Stripe webhooks with correct security ordering:
   * 1. Signature verification (cheap reject if invalid)
   * 2. Rate limiting (tenant/provider scoped)
   * 3. Business processing
   */
  @Post('stripe')
  async handleStripeWebhook(
    @Body() rawPayload: any,
    @Headers('stripe-signature') signature: string,
    @Headers('x-tenant-id') tenantId?: string,
    @Req() req: Request
  ): Promise<{ status: string; message: string }> {
    return this.handleWebhook('stripe', rawPayload, signature, tenantId, req);
  }

  /**
   * Generic webhook handler with correct security ordering:
   * 1. Signature verification (cheap reject if invalid)
   * 2. Rate limiting (tenant/provider scoped)
   * 3. Business processing
   */
  private async handleWebhook(
    providerId: string,
    rawPayload: any,
    signature: string,
    tenantId?: string,
    req?: Request
  ): Promise<{ status: string; message: string }> {
    const correlationId = crypto.randomUUID();

    try {
      this.logger.log(`Processing ${providerId} webhook`, {
        providerId,
        tenantId: tenantId || 'unknown',
        correlationId,
        hasSignature: !!signature,
      });

      // Step 1: Validate tenant context
      if (!tenantId) {
        throw new BadRequestException('Missing tenant identifier');
      }

      // Step 2: Get provider implementation
      const provider = this.providers.get(providerId);
      if (!provider) {
        throw new BadRequestException(
          `Unsupported payment provider: ${providerId}`
        );
      }

      // Step 3: Verify webhook signature (cheap reject if invalid)
      const payloadString =
        typeof rawPayload === 'string'
          ? rawPayload
          : JSON.stringify(rawPayload);
      const signatureValid = this.verifyWebhookSignature(
        provider,
        payloadString,
        signature,
        tenantId
      );

      if (!signatureValid) {
        this.logger.warn(`Invalid ${providerId} webhook signature`, {
          providerId,
          tenantId,
          correlationId,
        });
        throw new UnauthorizedException('Invalid webhook signature');
      }

      // Step 4: Rate limiting (only after signature verification passes)
      if (req) {
        await this.rateLimitService.enforceWebhookRateLimit({
          req,
          providerId,
        });
      }

      // Step 5: Parse and validate payment evidence
      const verificationResult = this.verifyWebhookPayload(
        provider,
        payloadString,
        tenantId
      );

      if (!verificationResult.isValid) {
        this.logger.warn(`Invalid ${providerId} webhook payload`, {
          providerId,
          tenantId,
          correlationId,
          error: verificationResult.error,
        });
        throw new BadRequestException(
          verificationResult.error || 'Invalid webhook payload'
        );
      }

      // Step 6: Business processing (only after signature + rate limit checks pass)
      // CRITICAL: Webhook cannot directly change business state
      const verificationRequest: PaymentVerificationRequest = {
        tenantId,
        evidence: verificationResult.evidence!,
        correlationId,
        providerId,
      };

      await this.paymentService.verifyPaymentFromWebhook(verificationRequest);

      this.logger.log(`Successfully processed ${providerId} webhook`, {
        providerId,
        tenantId,
        correlationId,
        paymentId: verificationResult.evidence?.providerPaymentId,
      });

      return {
        status: 'success',
        message: 'Webhook processed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to process ${providerId} webhook`, {
        providerId,
        tenantId: tenantId || 'unknown',
        correlationId,
        error: error.message,
      });

      // Return appropriate HTTP status based on error type
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Webhook processing failed');
    }
  }

  /**
   * Verify webhook signature using provider-specific logic
   */
  private verifyWebhookSignature(
    provider: IPaymentProvider,
    payload: string,
    signature: string,
    tenantId: string
  ): boolean {
    // Get webhook secret for this tenant and provider
    // In production, this would come from secure configuration
    const webhookSecret = this.getWebhookSecret(tenantId, provider.providerId);

    if (!webhookSecret) {
      this.logger.error(
        `No webhook secret configured for tenant ${tenantId}, provider ${provider.providerId}`
      );
      return false;
    }

    return provider.verifyWebhookSignature(payload, signature, webhookSecret);
  }

  /**
   * Parse and validate webhook payload
   */
  private verifyWebhookPayload(
    provider: IPaymentProvider,
    payload: string,
    tenantId: string
  ): WebhookVerificationResult {
    try {
      // Parse payment event
      const evidence = provider.parsePaymentEvent(payload);
      if (!evidence) {
        return {
          isValid: false,
          error: 'Could not parse payment event from webhook payload',
          providerId: provider.providerId,
        };
      }

      // Extract payment evidence with tenant context
      const processedEvidence = provider.extractPaymentEvidence(
        evidence,
        tenantId
      );

      // Additional validation
      if (!processedEvidence.providerPaymentId || !processedEvidence.eventId) {
        return {
          isValid: false,
          error: 'Missing required payment identifiers',
          providerId: provider.providerId,
        };
      }

      return {
        isValid: true,
        evidence: processedEvidence,
        providerId: provider.providerId,
      };
    } catch (error) {
      return {
        isValid: false,
        error: `Payload parsing failed: ${error.message}`,
        providerId: provider.providerId,
      };
    }
  }

  /**
   * Get webhook secret for tenant and provider
   * In production, this would be securely retrieved from configuration
   */
  private getWebhookSecret(
    tenantId: string,
    providerId: string
  ): string | null {
    // PLACEHOLDER: In production, this would be securely retrieved
    // from environment variables, secure configuration, or key vault
    const secrets = {
      'tenant-a': {
        stripe:
          process.env.STRIPE_WEBHOOK_SECRET_TENANT_A ||
          'whsec_test_placeholder_a',
      },
      'tenant-b': {
        stripe:
          process.env.STRIPE_WEBHOOK_SECRET_TENANT_B ||
          'whsec_test_placeholder_b',
      },
    };

    return secrets[tenantId]?.[providerId] || null;
  }
}
