/**
 * Payment Provider Interface - REQ-001: External Payment Verification
 *
 * Defines the contract for external payment providers to submit payment evidence
 * for NeuronX verification. Providers are NOT trusted - all evidence must be
 * independently verified by PaymentService.
 */

import { PaymentRecord } from '../payment.types';

/**
 * Payment evidence extracted from provider webhook
 * This is the ONLY data PaymentService accepts from external providers
 */
export interface PaymentEvidence {
  /** Provider-specific payment identifier */
  providerPaymentId: string;

  /** Amount in smallest currency unit (cents for USD) */
  amount: number;

  /** ISO 4217 currency code */
  currency: string;

  /** Payment status from provider */
  status: 'succeeded' | 'failed' | 'canceled' | 'pending';

  /** Provider timestamp for the payment event */
  providerTimestamp: string;

  /** Unique event identifier for replay protection */
  eventId: string;

  /** Additional provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Payment provider interface
 * All payment providers must implement this interface
 */
export interface IPaymentProvider {
  /** Provider identifier (e.g., 'stripe', 'paypal') */
  readonly providerId: string;

  /**
   * Verify webhook signature
   * @param payload Raw webhook payload
   * @param signature Signature from webhook headers
   * @param secret Webhook secret for verification
   * @returns true if signature is valid
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean;

  /**
   * Parse payment event from webhook payload
   * @param payload Raw webhook payload
   * @returns Parsed payment evidence or null if invalid
   */
  parsePaymentEvent(payload: string): PaymentEvidence | null;

  /**
   * Extract payment evidence from parsed event
   * @param evidence Parsed payment evidence
   * @param tenantId Tenant context for additional validation
   * @returns Payment evidence ready for NeuronX verification
   */
  extractPaymentEvidence(
    evidence: PaymentEvidence,
    tenantId: string
  ): PaymentEvidence;
}

/**
 * Webhook verification result
 * Returned by webhook controller after signature and parsing validation
 */
export interface WebhookVerificationResult {
  /** Whether webhook is valid and can be processed */
  isValid: boolean;

  /** Parsed payment evidence if valid */
  evidence?: PaymentEvidence;

  /** Error message if invalid */
  error?: string;

  /** Provider identifier */
  providerId: string;
}

/**
 * Payment verification request
 * Sent from webhook controller to PaymentService for independent verification
 */
export interface PaymentVerificationRequest {
  /** Tenant identifier */
  tenantId: string;

  /** Payment evidence from provider */
  evidence: PaymentEvidence;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Provider identifier */
  providerId: string;
}

/**
 * Provider-specific configuration
 * Each provider may have different configuration requirements
 */
export interface ProviderConfig {
  /** Webhook secret for signature verification */
  webhookSecret: string;

  /** Additional provider-specific configuration */
  [key: string]: unknown;
}
