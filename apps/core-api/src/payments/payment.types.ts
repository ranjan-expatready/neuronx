/**
 * Payment Types - REQ-001: PAID → CaseOpen State Gate
 *
 * Canonical payment state model for revenue and compliance-critical operations.
 * Defines the authoritative payment record structure and status states.
 */

export type PaymentStatus = 'INITIATED' | 'PAID' | 'FAILED' | 'REFUNDED';

/**
 * Canonical payment record structure
 * Represents a single payment transaction with full audit trail
 */
export interface PaymentRecord {
  /** Unique payment identifier */
  paymentId: string;

  /** Tenant isolation identifier */
  tenantId: string;

  /** Payment amount in smallest currency unit (cents for USD) */
  amount: number;

  /** ISO 4217 currency code */
  currency: string;

  /** Payment source identifier (opportunity ID, invoice ID, etc.) */
  source: string;

  /** Current payment status */
  status: PaymentStatus;

  /** Timestamp when payment was initiated */
  initiatedAt: string;

  /** Timestamp when payment was verified as paid (required for PAID status) */
  verifiedAt?: string;

  /** External payment provider reference ID */
  externalReference?: string;

  /** Additional metadata for audit and debugging */
  metadata?: Record<string, unknown>;

  /** Timestamp of last status update */
  updatedAt: string;
}

/**
 * Payment creation request
 * Used when initiating a new payment transaction
 */
export interface PaymentCreationRequest {
  tenantId: string;
  amount: number;
  currency: string;
  source: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Payment verification request
 * Used when confirming payment completion from external sources
 */
export interface PaymentVerificationRequest {
  paymentId: string;
  tenantId: string;
  externalReference?: string;
  verificationData?: Record<string, unknown>;
}

/**
 * Payment query result
 * Returned when querying payment status
 */
export interface PaymentQueryResult {
  payment: PaymentRecord | null;
  found: boolean;
}

/**
 * Payment status transition
 * Represents a change in payment status with audit information
 */
export interface PaymentStatusTransition {
  paymentId: string;
  tenantId: string;
  fromStatus: PaymentStatus;
  toStatus: PaymentStatus;
  timestamp: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}
