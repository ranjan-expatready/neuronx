/**
 * Stripe Payment Provider - Example Implementation
 *
 * Stripe provider implementation for webhook verification and payment evidence extraction.
 * This is an EXAMPLE implementation - in production, this would be a separate package.
 */

import {
  IPaymentProvider,
  PaymentEvidence,
} from './payment-provider.interface';

/**
 * Stripe webhook event structure (simplified)
 */
interface StripeWebhookEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: {
      id: string;
      object: 'payment_intent' | 'charge';
      amount: number;
      currency: string;
      status: 'succeeded' | 'failed' | 'canceled' | 'pending';
      metadata?: Record<string, string>;
    };
  };
  livemode: boolean;
  pending_webhooks: number;
  request?: {
    id: string;
    idempotency_key?: string;
  };
  type: string;
}

/**
 * Stripe payment provider implementation
 */
export class StripePaymentProvider implements IPaymentProvider {
  readonly providerId = 'stripe';

  /**
   * Verify Stripe webhook signature using HMAC-SHA256
   * @param payload Raw webhook payload
   * @param signature Stripe signature header
   * @param secret Webhook endpoint secret
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      // Parse signature header - format: t=1492774577,v1=abc123,v1=def456
      const signatureParts = signature.split(',');
      const timestampPart = signatureParts.find(part => part.startsWith('t='));
      const v1Signatures = signatureParts.filter(part =>
        part.startsWith('v1=')
      );

      if (!timestampPart || v1Signatures.length === 0) {
        return false;
      }

      const timestamp = timestampPart.split('=')[1];

      // Create signed payload
      const signedPayload = `${timestamp}.${payload}`;

      // Import crypto for HMAC verification
      const crypto = require('crypto');

      // Verify against each v1 signature
      for (const sigPart of v1Signatures) {
        const signatureValue = sigPart.split('=')[1];
        const expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(signedPayload)
          .digest('hex');

        if (signatureValue === expectedSignature) {
          return true;
        }
      }

      return false;
    } catch (error) {
      // Log error but don't expose details
      console.error('Stripe signature verification failed:', error.message);
      return false;
    }
  }

  /**
   * Parse Stripe webhook payload
   * @param payload Raw JSON webhook payload
   */
  parsePaymentEvent(payload: string): PaymentEvidence | null {
    try {
      const event: StripeWebhookEvent = JSON.parse(payload);

      // Only process payment-related events
      if (!this.isPaymentEvent(event.type)) {
        return null;
      }

      const paymentObject = event.data.object;

      // Convert Stripe amount (cents) to our format
      const amount = paymentObject.amount;

      // Convert Stripe status to our standardized status
      const status = this.mapStripeStatus(paymentObject.status);

      return {
        providerPaymentId: paymentObject.id,
        amount,
        currency: paymentObject.currency.toUpperCase(),
        status,
        providerTimestamp: new Date(event.created * 1000).toISOString(),
        eventId: event.id,
        metadata: {
          stripeEventType: event.type,
          livemode: event.livemode,
          apiVersion: event.api_version,
          ...paymentObject.metadata,
        },
      };
    } catch (error) {
      console.error('Failed to parse Stripe webhook payload:', error.message);
      return null;
    }
  }

  /**
   * Extract payment evidence with tenant context
   * @param evidence Parsed payment evidence
   * @param tenantId Tenant context (may be used for additional validation)
   */
  extractPaymentEvidence(
    evidence: PaymentEvidence,
    tenantId: string
  ): PaymentEvidence {
    // Add tenant context to metadata for audit purposes
    return {
      ...evidence,
      metadata: {
        ...evidence.metadata,
        neuronxTenantId: tenantId,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Check if Stripe event type is payment-related
   */
  private isPaymentEvent(eventType: string): boolean {
    const paymentEventTypes = [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'charge.succeeded',
      'charge.failed',
      'charge.dispute.created', // Could trigger refunds
    ];

    return paymentEventTypes.includes(eventType);
  }

  /**
   * Map Stripe payment status to our standardized status
   */
  private mapStripeStatus(stripeStatus: string): PaymentEvidence['status'] {
    switch (stripeStatus) {
      case 'succeeded':
        return 'succeeded';
      case 'failed':
        return 'failed';
      case 'canceled':
        return 'canceled';
      default:
        return 'pending';
    }
  }
}

/**
 * Export singleton instance
 * In production, this would be configured per environment
 */
export const stripePaymentProvider = new StripePaymentProvider();
