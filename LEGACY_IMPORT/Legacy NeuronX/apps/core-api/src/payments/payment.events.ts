/**
 * Payment Events - REQ-001: PAID → CaseOpen State Gate
 *
 * Canonical payment event definitions for the revenue-critical PAID → CaseOpen state transition.
 * Only payment.paid events may trigger CaseOpen state transitions.
 */

import { PaymentRecord, PaymentStatusTransition } from './payment.types';

/**
 * Payment event types
 * These are the only authorized payment events in the system
 */
export type PaymentEventType =
  | 'payment.initiated'
  | 'payment.paid' // ONLY this event may trigger CaseOpen
  | 'payment.failed'
  | 'payment.refunded';

/**
 * Base payment event structure
 * All payment events must include tenant isolation and audit trail
 */
export interface PaymentEvent {
  /** Event type identifier */
  type: PaymentEventType;

  /** Tenant isolation identifier */
  tenantId: string;

  /** Unique event identifier */
  eventId: string;

  /** Event timestamp */
  timestamp: string;

  /** Correlation ID for tracing */
  correlationId: string;

  /** Payment event payload */
  payload: PaymentEventPayload;
}

/**
 * Payment event payload discriminator
 * Ensures type safety for different payment event types
 */
export type PaymentEventPayload =
  | PaymentInitiatedPayload
  | PaymentPaidPayload
  | PaymentFailedPayload
  | PaymentRefundedPayload;

/**
 * Payment initiated event payload
 * Emitted when a payment transaction is started
 */
export interface PaymentInitiatedPayload {
  payment: PaymentRecord;
  initiatedBy: string; // User or system identifier
  expectedCompletionAt?: string; // Expected completion timestamp
}

/**
 * Payment paid event payload - REVENUE CRITICAL
 * ONLY this event type may trigger CaseOpen state transitions
 * Must include verifiedAt timestamp for audit compliance
 */
export interface PaymentPaidPayload {
  payment: PaymentRecord;
  verifiedAt: string; // Required: timestamp of payment verification
  verifiedBy: string; // System or user that verified the payment
  verificationMethod: 'webhook' | 'manual' | 'api' | 'reconciliation';
  previousStatus: PaymentStatusTransition['fromStatus'];
}

/**
 * Payment failed event payload
 * Emitted when a payment transaction fails permanently
 */
export interface PaymentFailedPayload {
  payment: PaymentRecord;
  failedAt: string;
  failureReason: string;
  failureCode?: string;
  previousStatus: PaymentStatusTransition['fromStatus'];
  retryable: boolean;
}

/**
 * Payment refunded event payload
 * Emitted when a payment is refunded (may reverse CaseOpen)
 */
export interface PaymentRefundedPayload {
  payment: PaymentRecord;
  refundedAt: string;
  refundAmount: number;
  refundReason: string;
  refundedBy: string;
  previousStatus: PaymentStatusTransition['fromStatus'];
}

/**
 * Payment event emission helper
 * Ensures consistent event structure and audit trail
 */
export class PaymentEventEmitter {
  /**
   * Create a payment.initiated event
   */
  static paymentInitiated(
    tenantId: string,
    payment: PaymentRecord,
    correlationId: string,
    initiatedBy: string,
    expectedCompletionAt?: string
  ): PaymentEvent {
    return {
      type: 'payment.initiated',
      tenantId,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        payment,
        initiatedBy,
        expectedCompletionAt,
      },
    };
  }

  /**
   * Create a payment.paid event - REVENUE CRITICAL
   * This is the ONLY event that may trigger CaseOpen
   */
  static paymentPaid(
    tenantId: string,
    payment: PaymentRecord,
    correlationId: string,
    verifiedBy: string,
    verificationMethod: PaymentPaidPayload['verificationMethod'],
    previousStatus: PaymentStatusTransition['fromStatus']
  ): PaymentEvent {
    if (!payment.verifiedAt) {
      throw new Error(
        'Payment must have verifiedAt timestamp to emit payment.paid event'
      );
    }

    return {
      type: 'payment.paid',
      tenantId,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        payment,
        verifiedAt: payment.verifiedAt,
        verifiedBy,
        verificationMethod,
        previousStatus,
      },
    };
  }

  /**
   * Create a payment.failed event
   */
  static paymentFailed(
    tenantId: string,
    payment: PaymentRecord,
    correlationId: string,
    failureReason: string,
    failureCode?: string,
    retryable: boolean = false,
    previousStatus: PaymentStatusTransition['fromStatus']
  ): PaymentEvent {
    return {
      type: 'payment.failed',
      tenantId,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        payment,
        failedAt: new Date().toISOString(),
        failureReason,
        failureCode,
        previousStatus,
        retryable,
      },
    };
  }

  /**
   * Create a payment.refunded event
   */
  static paymentRefunded(
    tenantId: string,
    payment: PaymentRecord,
    correlationId: string,
    refundAmount: number,
    refundReason: string,
    refundedBy: string,
    previousStatus: PaymentStatusTransition['fromStatus']
  ): PaymentEvent {
    return {
      type: 'payment.refunded',
      tenantId,
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      correlationId,
      payload: {
        payment,
        refundedAt: new Date().toISOString(),
        refundAmount,
        refundReason,
        refundedBy,
        previousStatus,
      },
    };
  }
}
