/**
 * GHL Billing Adapter Types - WI-041
 *
 * Types for GHL billing webhook events and entitlement sync.
 */

import { z } from 'zod';

// Billing status mapped to NeuronX entitlement states
export enum BillingStatus {
  ACTIVE = 'ACTIVE', // Subscription active, full access
  GRACE = 'GRACE', // Past due or unpaid, warning but allow
  BLOCKED = 'BLOCKED', // Canceled or suspended, hard block
}

// Supported GHL billing events (the only ones we process)
export enum GhlBillingEventType {
  SUBSCRIPTION_CREATED = 'subscription.created',
  SUBSCRIPTION_UPDATED = 'subscription.updated',
  SUBSCRIPTION_CANCELED = 'subscription.canceled',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_PAYMENT_SUCCEEDED = 'invoice.payment_succeeded',
}

// GHL subscription states we map from
export enum GhlSubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  CANCELED = 'canceled',
  TRIALING = 'trialing',
}

// GHL product/plan identifiers (now policy-driven, not hardcoded)
// See policy/plan-mapping-policy.types.ts for current definitions

// Raw GHL webhook payload structures (minimal, what we need)
export interface GhlWebhookPayload {
  event: {
    id: string;
    type: GhlBillingEventType;
    created: number;
    data: {
      object: any; // The subscription or invoice object
    };
  };
  // Other webhook metadata we don't use
}

// Normalized billing event for processing
export interface NormalizedBillingEvent {
  eventId: string;
  eventType: GhlBillingEventType;
  tenantId: string; // Derived from GHL account/location
  ghlAccountId: string;
  subscriptionId?: string;
  invoiceId?: string;
  subscriptionStatus?: GhlSubscriptionStatus;
  productId?: string;
  amount?: number;
  currency?: string;
  occurredAt: Date;
  rawPayload: any; // For audit/debugging
}

// Entitlement sync result
export interface EntitlementSyncResult {
  tenantId: string;
  billingStatus: BillingStatus;
  planTier: string; // FREE, PRO, ENTERPRISE
  reason: string;
  changed: boolean;
  previousStatus?: BillingStatus;
  previousPlanTier?: string;
}

// Zod schemas for validation
export const GhlWebhookPayloadSchema = z.object({
  event: z.object({
    id: z.string(),
    type: z.nativeEnum(GhlBillingEventType),
    created: z.number(),
    data: z.object({
      object: z.any(),
    }),
  }),
});

// Configuration for GHL billing adapter (plan mappings now policy-driven)
export interface GhlBillingConfig {
  gracePeriodDays: number; // How long to allow in GRACE status
  webhookSignatureVerification: boolean;
  // productMappings and defaultPlanTier removed - now policy-driven
}

// Default configuration (minimal, policy handles mappings)
export const DEFAULT_GHL_BILLING_CONFIG: GhlBillingConfig = {
  gracePeriodDays: 7,
  webhookSignatureVerification: true,
};
