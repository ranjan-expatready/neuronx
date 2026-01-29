/**
 * Payment Service - REQ-001: PAID → CaseOpen State Gate
 *
 * Authoritative payment state management for revenue-critical operations.
 * Only this service may emit payment.paid events that trigger CaseOpen transitions.
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from '../eventing';
import { DurableEventPublisherService } from '../eventing/durable-event-publisher';
import { AuditService } from '../audit/audit.service';
import { PaymentRepository } from './payment.repository';
import {
  PaymentRecord,
  PaymentStatus,
  PaymentCreationRequest,
  PaymentVerificationRequest,
  PaymentQueryResult,
  PaymentStatusTransition,
} from './payment.types';
import { PaymentEventEmitter } from './payment.events';
import { PaymentVerificationRequest as WebhookVerificationRequest } from './providers/payment-provider.interface';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly eventBus: EventBus,
    private readonly durableEventPublisher: DurableEventPublisherService,
    private readonly auditService: AuditService,
    private readonly paymentRepository: PaymentRepository
  ) {}

  /**
   * Initiate a new payment transaction
   * Creates payment record in INITIATED status
   */
  async initiatePayment(
    request: PaymentCreationRequest,
    correlationId: string,
    initiatedBy: string
  ): Promise<PaymentRecord> {
    // Create payment record in database
    const payment = await this.paymentRepository.createPayment(
      request,
      correlationId
    );

    this.logger.log(`Payment initiated: ${payment.paymentId}`, {
      tenantId: request.tenantId,
      amount: payment.amount,
      currency: payment.currency,
      source: payment.source,
      correlationId,
    });

    // Emit payment.initiated event
    const event = PaymentEventEmitter.paymentInitiated(
      request.tenantId,
      payment,
      correlationId,
      initiatedBy
    );

    await this.eventBus.publish(event);

    // Audit: payment initiated
    await this.auditService.logEvent('payment.initiated', {
      paymentId: payment.paymentId,
      tenantId: request.tenantId,
      amount: payment.amount,
      currency: payment.currency,
      source: payment.source,
      initiatedBy,
      correlationId,
    });

    return payment;
  }

  /**
   * Verify and complete a payment transaction - REVENUE CRITICAL
   * This method is the ONLY way to transition to PAID status
   * Only PAID payments may trigger CaseOpen state transitions
   */
  async verifyPayment(
    request: PaymentVerificationRequest,
    correlationId: string,
    verifiedBy: string,
    verificationMethod:
      | 'webhook'
      | 'manual'
      | 'api'
      | 'reconciliation' = 'manual'
  ): Promise<PaymentRecord> {
    const { paymentId, tenantId } = request;

    // Check if payment is already PAID (idempotent)
    const existingPayment = await this.paymentRepository.findById(
      paymentId,
      tenantId
    );
    if (existingPayment?.status === 'PAID') {
      this.logger.warn(
        `Payment ${paymentId} is already PAID, ignoring duplicate verification`,
        {
          tenantId,
          correlationId,
        }
      );
      return existingPayment; // Idempotent - return existing PAID payment
    }

    const previousStatus = existingPayment?.status || 'INITIATED';

    // CRITICAL: Emit payment.paid event DURABLY within the same transaction
    // This ensures the event is published only if payment state change commits
    const paidEvent = PaymentEventEmitter.paymentPaid(
      tenantId,
      existingPayment || {
        paymentId,
        tenantId,
        amount: 0, // Will be updated in transaction
        currency: 'USD',
        source: '',
        status: 'INITIATED',
        initiatedAt: new Date().toISOString(),
      },
      correlationId,
      verifiedBy,
      verificationMethod,
      previousStatus
    );

    // Execute payment verification and event publishing atomically
    const updatedPayment = await this.paymentRepository.markPaidVerifiedAtomic(
      paymentId,
      tenantId,
      verifiedBy,
      verificationMethod,
      correlationId,
      async transaction => {
        // Store event in outbox within the same transaction
        await this.durableEventPublisher.publishInTransaction(
          {
            tenantId,
            eventId: paidEvent.id,
            eventType: paidEvent.type,
            payload: paidEvent.payload,
            correlationId,
            idempotencyKey: `payment-paid-${paymentId}`,
            sourceService: 'payment-service',
          },
          transaction
        );
      }
    );

    this.logger.log(`Payment verified and marked as PAID: ${paymentId}`, {
      tenantId,
      amount: updatedPayment.amount,
      currency: updatedPayment.currency,
      source: updatedPayment.source,
      verifiedBy,
      verificationMethod,
      correlationId,
    });

    // Audit: payment verified as paid - REVENUE CRITICAL
    await this.auditService.logEvent('payment.verified.paid', {
      paymentId,
      tenantId,
      amount: payment.amount,
      currency: payment.currency,
      source: payment.source,
      verifiedAt,
      verifiedBy,
      verificationMethod,
      previousStatus,
      correlationId,
    });

    return updatedPayment;
  }

  /**
   * Mark payment as failed
   */
  async failPayment(
    paymentId: string,
    tenantId: string,
    failureReason: string,
    correlationId: string,
    failedBy: string,
    failureCode?: string,
    retryable: boolean = false
  ): Promise<PaymentRecord> {
    const payment = this.payments.get(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    if (payment.tenantId !== tenantId) {
      throw new Error(
        `Payment ${paymentId} does not belong to tenant ${tenantId}`
      );
    }

    if (payment.status === 'PAID' || payment.status === 'FAILED') {
      throw new Error(
        `Cannot fail payment ${paymentId} in status ${payment.status}`
      );
    }

    const previousStatus = payment.status;
    const failedAt = new Date().toISOString();

    const updatedPayment: PaymentRecord = {
      ...payment,
      status: 'FAILED',
      updatedAt: failedAt,
      metadata: {
        ...payment.metadata,
        failureReason,
        failureCode,
        failedAt,
        failedBy,
      },
    };

    this.payments.set(paymentId, updatedPayment);

    this.logger.log(`Payment marked as FAILED: ${paymentId}`, {
      tenantId,
      failureReason,
      correlationId,
    });

    // Emit payment.failed event
    const event = PaymentEventEmitter.paymentFailed(
      tenantId,
      updatedPayment,
      correlationId,
      failureReason,
      failureCode,
      retryable,
      previousStatus
    );

    await this.eventBus.publish(event);

    // Audit: payment failed
    await this.auditService.logEvent('payment.failed', {
      paymentId,
      tenantId,
      failureReason,
      failedBy,
      correlationId,
    });

    return updatedPayment;
  }

  /**
   * Query payment status
   */
  async getPayment(
    paymentId: string,
    tenantId: string
  ): Promise<PaymentQueryResult> {
    const payment = this.payments.get(paymentId);

    if (!payment) {
      return { payment: null, found: false };
    }

    if (payment.tenantId !== tenantId) {
      throw new Error(
        `Payment ${paymentId} does not belong to tenant ${tenantId}`
      );
    }

    return { payment, found: true };
  }

  /**
   * Get all payments for a tenant (admin/debugging only)
   */
  async getTenantPayments(tenantId: string): Promise<PaymentRecord[]> {
    return Array.from(this.payments.values()).filter(
      payment => payment.tenantId === tenantId
    );
  }

  /**
   * Check if payment is in PAID status with verification
   * This is the authoritative check for CaseOpen eligibility
   */
  isPaymentVerifiedPaid(paymentId: string, tenantId: string): boolean {
    const payment = this.payments.get(paymentId);

    return (
      payment !== undefined &&
      payment.tenantId === tenantId &&
      payment.status === 'PAID' &&
      payment.verifiedAt !== undefined
    );
  }

  /**
   * Verify payment from webhook evidence - CRITICAL EXTERNAL INTEGRATION
   *
   * This method provides the ONLY path for external payment providers to influence
   * NeuronX payment state. The webhook controller forwards evidence, but PaymentService
   * performs independent verification against existing PaymentRecords.
   *
   * @param request Webhook verification request with provider evidence
   */
  async verifyPaymentFromWebhook(
    request: WebhookVerificationRequest
  ): Promise<PaymentRecord> {
    const { tenantId, evidence, correlationId, providerId } = request;

    this.logger.log(`Verifying payment from ${providerId} webhook evidence`, {
      tenantId,
      providerId,
      providerPaymentId: evidence.providerPaymentId,
      correlationId,
    });

    // Step 1: Find existing PaymentRecord to verify against
    const existingPayment = await this.findPaymentByEvidence(
      evidence,
      tenantId,
      providerId
    );

    if (!existingPayment) {
      this.logger.warn(
        `No matching NeuronX payment found for ${providerId} webhook evidence`,
        {
          tenantId,
          providerId,
          providerPaymentId: evidence.providerPaymentId,
          correlationId,
        }
      );
      throw new Error(
        `No matching payment record found for provider payment ${evidence.providerPaymentId}`
      );
    }

    // Step 2: Independently verify webhook evidence against our records
    const verificationResult = this.verifyWebhookEvidence(
      existingPayment,
      evidence,
      providerId
    );

    if (!verificationResult.isValid) {
      this.logger.warn(
        `Webhook evidence verification failed for payment ${existingPayment.paymentId}`,
        {
          tenantId,
          paymentId: existingPayment.paymentId,
          providerId,
          correlationId,
          reason: verificationResult.reason,
        }
      );
      throw new Error(
        `Webhook evidence verification failed: ${verificationResult.reason}`
      );
    }

    // Step 3: Only proceed if webhook indicates successful payment
    if (evidence.status !== 'succeeded') {
      this.logger.log(
        `Webhook indicates non-successful payment status: ${evidence.status}`,
        {
          tenantId,
          paymentId: existingPayment.paymentId,
          providerId,
          status: evidence.status,
          correlationId,
        }
      );

      // Handle non-successful statuses appropriately
      if (evidence.status === 'failed') {
        return this.failPayment(
          existingPayment.paymentId,
          tenantId,
          'Payment failed according to provider webhook',
          correlationId,
          `webhook-${providerId}`,
          undefined,
          false // Not retryable since provider confirmed failure
        );
      }

      // For pending/canceled, just log and return current state
      return existingPayment;
    }

    // Step 4: CRITICAL - Only now can we transition to PAID
    // This is the ONLY place where external webhooks can influence payment state
    return this.verifyPayment(
      {
        paymentId: existingPayment.paymentId,
        tenantId,
        externalReference: evidence.providerPaymentId,
        verificationData: evidence,
      },
      correlationId,
      `webhook-${providerId}`,
      'webhook' // Verification method
    );
  }

  /**
   * Find existing payment record by webhook evidence
   * Uses multiple matching strategies for reliability
   */
  private async findPaymentByEvidence(
    evidence: any,
    tenantId: string,
    providerId: string
  ): Promise<PaymentRecord | null> {
    // Strategy 1: Match by provider event ID (most reliable)
    if (evidence.providerPaymentId) {
      const payment = await this.paymentRepository.findByEvidence(
        tenantId,
        providerId,
        evidence.providerPaymentId
      );
      if (payment) return payment;
    }

    // Strategy 2: Match by external reference (fallback)
    if (evidence.providerPaymentId) {
      const payment = await this.paymentRepository.findByEvidence(
        tenantId,
        undefined,
        undefined,
        evidence.providerPaymentId
      );
      if (payment) return payment;
    }

    // Strategy 3: Match by amount and currency for same tenant (last resort)
    // This is less reliable but may be necessary for some providers
    if (evidence.amount && evidence.currency) {
      // For now, we'll need to query payments and filter in memory
      // In a future enhancement, we could add this as a repository method
      const { payments } = await this.paymentRepository.queryPayments(
        tenantId,
        {
          status: 'INITIATED',
          limit: 100, // Reasonable limit to prevent excessive matching
        }
      );

      const matchingPayment = payments.find(
        payment =>
          payment.amount === evidence.amount &&
          payment.currency === evidence.currency &&
          payment.status === 'INITIATED'
      );

      if (matchingPayment) return matchingPayment;
    }

    return null;
  }

  /**
   * Independently verify webhook evidence against our payment record
   * CRITICAL: This verification is what makes external webhooks trustworthy
   */
  private verifyWebhookEvidence(
    payment: PaymentRecord,
    evidence: any,
    providerId: string
  ): { isValid: boolean; reason?: string } {
    // Verification 1: Amount must match exactly
    if (payment.amount !== evidence.amount) {
      return {
        isValid: false,
        reason: `Amount mismatch: expected ${payment.amount}, got ${evidence.amount}`,
      };
    }

    // Verification 2: Currency must match exactly
    if (payment.currency !== evidence.currency) {
      return {
        isValid: false,
        reason: `Currency mismatch: expected ${payment.currency}, got ${evidence.currency}`,
      };
    }

    // Verification 3: Payment must be in expected state
    if (payment.status !== 'INITIATED') {
      return {
        isValid: false,
        reason: `Payment in unexpected state: ${payment.status}`,
      };
    }

    // Verification 4: Provider timestamp should be reasonable (not in future, not too old)
    const providerTime = new Date(evidence.providerTimestamp).getTime();
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    const oneHourFromNow = now + 60 * 60 * 1000;

    if (providerTime < fiveMinutesAgo) {
      return {
        isValid: false,
        reason: 'Provider timestamp is too old (more than 5 minutes ago)',
      };
    }

    if (providerTime > oneHourFromNow) {
      return {
        isValid: false,
        reason: 'Provider timestamp is in the future',
      };
    }

    // Verification 5: Event ID should be present for replay protection
    if (!evidence.eventId) {
      return {
        isValid: false,
        reason: 'Missing event ID for replay protection',
      };
    }

    // Additional provider-specific verifications could go here

    return { isValid: true };
  }

  /**
   * Clear all payments (for testing only)
   */
  clearAllPayments(): void {
    this.payments.clear();
  }
}
