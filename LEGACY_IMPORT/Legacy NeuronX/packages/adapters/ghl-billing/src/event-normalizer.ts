/**
 * GHL Billing Event Normalizer - WI-041
 *
 * Normalizes GHL billing webhook payloads into standardized billing events.
 * Only processes the specific events we care about for entitlement sync.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  GhlWebhookPayload,
  GhlBillingEventType,
  GhlSubscriptionStatus,
  NormalizedBillingEvent,
  GhlWebhookPayloadSchema,
} from './types';

@Injectable()
export class GhlBillingEventNormalizer {
  private readonly logger = new Logger(GhlBillingEventNormalizer.name);

  /**
   * Normalize a GHL webhook payload into a billing event
   * Returns null if the event type is not supported
   */
  normalizeEvent(
    payload: GhlWebhookPayload,
    tenantId: string
  ): NormalizedBillingEvent | null {
    try {
      // Validate payload structure
      const validatedPayload = GhlWebhookPayloadSchema.parse(payload);

      const { event } = validatedPayload;
      const { id: eventId, type: eventType, created, data } = event;

      // Only process supported event types
      if (!this.isSupportedEventType(eventType)) {
        this.logger.debug(`Ignoring unsupported event type: ${eventType}`, {
          eventId,
        });
        return null;
      }

      // Extract billing event data
      const billingEvent = this.extractBillingEventData(eventType, data.object);

      if (!billingEvent) {
        this.logger.warn(`Failed to extract billing data from event`, {
          eventId,
          eventType,
          tenantId,
        });
        return null;
      }

      // Create normalized event
      const normalizedEvent: NormalizedBillingEvent = {
        eventId,
        eventType,
        tenantId,
        ghlAccountId: billingEvent.ghlAccountId,
        subscriptionId: billingEvent.subscriptionId,
        invoiceId: billingEvent.invoiceId,
        subscriptionStatus: billingEvent.subscriptionStatus,
        productId: billingEvent.productId,
        amount: billingEvent.amount,
        currency: billingEvent.currency,
        occurredAt: new Date(created * 1000), // Convert Unix timestamp
        rawPayload: payload, // Keep for audit/debugging
      };

      this.logger.debug(`Normalized billing event`, {
        eventId,
        eventType,
        tenantId,
        billingStatus: billingEvent.subscriptionStatus,
      });

      return normalizedEvent;
    } catch (error) {
      this.logger.error(`Failed to normalize GHL billing event`, {
        error: error.message,
        tenantId,
        payload: JSON.stringify(payload).substring(0, 500),
      });
      return null;
    }
  }

  /**
   * Check if we support processing this event type
   */
  private isSupportedEventType(eventType: GhlBillingEventType): boolean {
    const supportedTypes = [
      GhlBillingEventType.SUBSCRIPTION_CREATED,
      GhlBillingEventType.SUBSCRIPTION_UPDATED,
      GhlBillingEventType.SUBSCRIPTION_CANCELED,
      GhlBillingEventType.INVOICE_PAYMENT_FAILED,
      GhlBillingEventType.INVOICE_PAYMENT_SUCCEEDED,
    ];

    return supportedTypes.includes(eventType);
  }

  /**
   * Extract billing-relevant data from GHL event payload
   */
  private extractBillingEventData(
    eventType: GhlBillingEventType,
    eventObject: any
  ): {
    ghlAccountId: string;
    subscriptionId?: string;
    invoiceId?: string;
    subscriptionStatus?: GhlSubscriptionStatus;
    productId?: string;
    amount?: number;
    currency?: string;
  } | null {
    try {
      // Extract common fields
      const ghlAccountId =
        eventObject.account_id || eventObject.customer?.account_id;

      if (!ghlAccountId) {
        this.logger.warn(`No account ID found in event object`, { eventType });
        return null;
      }

      const result: any = { ghlAccountId };

      // Extract event-specific data
      switch (eventType) {
        case GhlBillingEventType.SUBSCRIPTION_CREATED:
        case GhlBillingEventType.SUBSCRIPTION_UPDATED:
        case GhlBillingEventType.SUBSCRIPTION_CANCELED:
          result.subscriptionId = eventObject.id;
          result.subscriptionStatus = this.mapSubscriptionStatus(
            eventObject.status
          );
          result.productId = eventObject.items?.data?.[0]?.price?.product; // Stripe product ID
          break;

        case GhlBillingEventType.INVOICE_PAYMENT_FAILED:
        case GhlBillingEventType.INVOICE_PAYMENT_SUCCEEDED:
          result.invoiceId = eventObject.id;
          result.subscriptionId = eventObject.subscription;
          result.amount = eventObject.amount_due;
          result.currency = eventObject.currency;
          // For invoice events, we don't change subscription status directly
          // The subscription status comes from separate subscription events
          break;

        default:
          return null;
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to extract billing data`, {
        eventType,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Map GHL/Stripe subscription status to our internal status
   */
  private mapSubscriptionStatus(
    ghlStatus: string
  ): GhlSubscriptionStatus | undefined {
    switch (ghlStatus?.toLowerCase()) {
      case 'active':
        return GhlSubscriptionStatus.ACTIVE;
      case 'past_due':
        return GhlSubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return GhlSubscriptionStatus.UNPAID;
      case 'canceled':
        return GhlSubscriptionStatus.CANCELED;
      case 'trialing':
        return GhlSubscriptionStatus.TRIALING;
      default:
        this.logger.warn(`Unknown subscription status: ${ghlStatus}`);
        return undefined;
    }
  }
}
