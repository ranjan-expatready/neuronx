/**
 * Payment Repository - WI-011: Payment Persistence
 *
 * PostgreSQL-backed payment repository with ACID transactions.
 * Implements the authoritative payment record storage with tenant isolation.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PrismaClient,
  PaymentRecord as PrismaPaymentRecord,
} from '@prisma/client';
import {
  PaymentRecord,
  PaymentStatus,
  PaymentCreationRequest,
  PaymentVerificationRequest,
  PaymentQueryResult,
} from './payment.types';

@Injectable()
export class PaymentRepository {
  private readonly logger = new Logger(PaymentRepository.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Create a new payment record
   */
  async createPayment(
    request: PaymentCreationRequest,
    correlationId?: string
  ): Promise<PaymentRecord> {
    const paymentId = crypto.randomUUID();

    const payment = await this.prisma.paymentRecord.create({
      data: {
        tenantId: request.tenantId,
        paymentId,
        amount: request.amount,
        currency: request.currency,
        source: request.source,
        externalReference: request.externalReference,
        correlationId,
        metadata: request.metadata || {},
      },
    });

    return this.mapToDomain(payment);
  }

  /**
   * Find payment by payment ID and tenant
   */
  async findById(
    paymentId: string,
    tenantId: string
  ): Promise<PaymentRecord | null> {
    const payment = await this.prisma.paymentRecord.findUnique({
      where: {
        tenantId_paymentId: {
          tenantId,
          paymentId,
        },
      },
    });

    return payment ? this.mapToDomain(payment) : null;
  }

  /**
   * Find payment by external provider evidence (for webhook verification)
   */
  async findByEvidence(
    tenantId: string,
    providerId?: string,
    providerEventId?: string,
    externalReference?: string
  ): Promise<PaymentRecord | null> {
    // Try multiple lookup strategies
    let payment: PrismaPaymentRecord | null = null;

    // Strategy 1: Provider event ID (most specific)
    if (providerId && providerEventId) {
      payment = await this.prisma.paymentRecord.findUnique({
        where: {
          tenantId_providerId_providerEventId: {
            tenantId,
            providerId,
            providerEventId,
          },
        },
      });
      if (payment) return this.mapToDomain(payment);
    }

    // Strategy 2: External reference
    if (externalReference) {
      payment = await this.prisma.paymentRecord.findFirst({
        where: {
          tenantId,
          externalReference,
        },
      });
      if (payment) return this.mapToDomain(payment);
    }

    // Strategy 3: Provider ID only (fallback)
    if (providerId) {
      payment = await this.prisma.paymentRecord.findFirst({
        where: {
          tenantId,
          providerId,
          status: 'INITIATED', // Only look at pending payments
        },
        orderBy: {
          createdAt: 'desc', // Most recent first
        },
      });
      if (payment) return this.mapToDomain(payment);
    }

    return null;
  }

  /**
   * Atomically mark payment as verified (INITIATED → PAID)
   * This is the critical transition that enables CaseOpen
   */
  async markPaidVerifiedAtomic(
    paymentId: string,
    tenantId: string,
    verifiedBy: string,
    verificationMethod: string,
    correlationId?: string,
    transactionCallback?: (transaction: any) => Promise<void>
  ): Promise<PaymentRecord> {
    return await this.prisma.$transaction(async tx => {
      // First, get the current payment with version for optimistic locking
      const currentPayment = await tx.paymentRecord.findUnique({
        where: {
          tenantId_paymentId: {
            tenantId,
            paymentId,
          },
        },
      });

      if (!currentPayment) {
        throw new Error(`Payment not found: ${paymentId}`);
      }

      if (currentPayment.status !== 'INITIATED') {
        throw new Error(
          `Payment ${paymentId} is not in INITIATED status (current: ${currentPayment.status})`
        );
      }

      // Update to PAID status with verification details
      const updatedPayment = await tx.paymentRecord.update({
        where: {
          tenantId_paymentId: {
            tenantId,
            paymentId,
          },
        },
        data: {
          status: 'PAID',
          verifiedAt: new Date(),
          verifiedBy,
          verificationMethod,
          correlationId: correlationId || currentPayment.correlationId,
          version: {
            increment: 1,
          },
        },
      });

      // Execute transaction callback if provided (e.g., store outbox event)
      if (transactionCallback) {
        await transactionCallback(tx);
      }

      return this.mapToDomain(updatedPayment);
    });
  }

  /**
   * Mark payment as failed
   */
  async markFailed(
    paymentId: string,
    tenantId: string,
    correlationId?: string
  ): Promise<PaymentRecord> {
    const updatedPayment = await this.prisma.paymentRecord.update({
      where: {
        tenantId_paymentId: {
          tenantId,
          paymentId,
        },
      },
      data: {
        status: 'FAILED',
        correlationId,
        version: {
          increment: 1,
        },
      },
    });

    return this.mapToDomain(updatedPayment);
  }

  /**
   * Mark payment as refunded
   */
  async markRefunded(
    paymentId: string,
    tenantId: string,
    correlationId?: string
  ): Promise<PaymentRecord> {
    const updatedPayment = await this.prisma.paymentRecord.update({
      where: {
        tenantId_paymentId: {
          tenantId,
          paymentId,
        },
      },
      data: {
        status: 'REFUNDED',
        correlationId,
        version: {
          increment: 1,
        },
      },
    });

    return this.mapToDomain(updatedPayment);
  }

  /**
   * Query payments with filters
   */
  async queryPayments(
    tenantId: string,
    filters: {
      status?: PaymentStatus;
      source?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ payments: PaymentRecord[]; total: number }> {
    const { status, source, limit = 50, offset = 0 } = filters;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(source && { source }),
    };

    const [payments, total] = await Promise.all([
      this.prisma.paymentRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.paymentRecord.count({ where }),
    ]);

    return {
      payments: payments.map(this.mapToDomain),
      total,
    };
  }

  /**
   * Get payment statistics for a tenant
   */
  async getPaymentStats(tenantId: string): Promise<{
    totalPayments: number;
    totalRevenue: number; // in cents
    paidPayments: number;
    failedPayments: number;
    refundedPayments: number;
  }> {
    const stats = await this.prisma.paymentRecord.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: {
        status: true,
      },
      _sum: {
        amount: true,
      },
    });

    const result = {
      totalPayments: 0,
      totalRevenue: 0,
      paidPayments: 0,
      failedPayments: 0,
      refundedPayments: 0,
    };

    for (const stat of stats) {
      result.totalPayments += stat._count.status;
      if (stat.status === 'PAID') {
        result.paidPayments = stat._count.status;
        result.totalRevenue = stat._sum.amount || 0;
      } else if (stat.status === 'FAILED') {
        result.failedPayments = stat._count.status;
      } else if (stat.status === 'REFUNDED') {
        result.refundedPayments = stat._count.status;
      }
    }

    return result;
  }

  /**
   * Map Prisma model to domain model
   */
  private mapToDomain(prismaPayment: PrismaPaymentRecord): PaymentRecord {
    return {
      paymentId: prismaPayment.paymentId,
      tenantId: prismaPayment.tenantId,
      amount: prismaPayment.amount,
      currency: prismaPayment.currency,
      source: prismaPayment.source,
      status: prismaPayment.status as PaymentStatus,
      initiatedAt: prismaPayment.initiatedAt.toISOString(),
      verifiedAt: prismaPayment.verifiedAt?.toISOString(),
      externalReference: prismaPayment.externalReference || undefined,
      metadata:
        (prismaPayment.metadata as Record<string, unknown>) || undefined,
      updatedAt: prismaPayment.updatedAt.toISOString(),
    };
  }
}
