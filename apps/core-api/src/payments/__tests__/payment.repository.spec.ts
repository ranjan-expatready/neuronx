/**
 * Payment Repository Tests - WI-011: Payment Persistence
 *
 * Tests for PostgreSQL-backed payment repository with ACID transactions.
 * Verifies revenue-critical payment operations are durable and consistent.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PaymentRepository } from '../payment.repository';
import { PaymentCreationRequest } from '../payment.types';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  paymentRecord: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('PaymentRepository', () => {
  let repository: PaymentRepository;
  let prismaMock: any;

  const testTenantId = 'test-tenant-123';
  const testPaymentId = 'payment-123';
  const testCorrelationId = 'corr-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentRepository,
        {
          provide: PrismaClient,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<PaymentRepository>(PaymentRepository);
    prismaMock = mockPrisma;

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('createPayment', () => {
    it('should create payment record with correct data', async () => {
      const request: PaymentCreationRequest = {
        tenantId: testTenantId,
        amount: 29900, // $299.00
        currency: 'USD',
        source: 'opportunity-123',
        externalReference: 'stripe-pi-123',
        metadata: { plan: 'premium' },
      };

      const mockCreatedPayment = {
        id: 'db-id-123',
        tenantId: testTenantId,
        paymentId: testPaymentId,
        amount: 29900,
        currency: 'USD',
        source: 'opportunity-123',
        status: 'INITIATED',
        initiatedAt: new Date('2026-01-03T10:00:00Z'),
        externalReference: 'stripe-pi-123',
        correlationId: testCorrelationId,
        metadata: { plan: 'premium' },
        createdAt: new Date('2026-01-03T10:00:00Z'),
        updatedAt: new Date('2026-01-03T10:00:00Z'),
      };

      prismaMock.paymentRecord.create.mockResolvedValue(mockCreatedPayment);

      const result = await repository.createPayment(request, testCorrelationId);

      expect(prismaMock.paymentRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: testTenantId,
          amount: 29900,
          currency: 'USD',
          source: 'opportunity-123',
          externalReference: 'stripe-pi-123',
          correlationId: testCorrelationId,
          metadata: { plan: 'premium' },
        }),
      });

      expect(result).toEqual({
        paymentId: testPaymentId,
        tenantId: testTenantId,
        amount: 29900,
        currency: 'USD',
        source: 'opportunity-123',
        status: 'INITIATED',
        initiatedAt: '2026-01-03T10:00:00.000Z',
        externalReference: 'stripe-pi-123',
        metadata: { plan: 'premium' },
        updatedAt: '2026-01-03T10:00:00.000Z',
      });
    });
  });

  describe('findById', () => {
    it('should return payment when found', async () => {
      const mockPayment = {
        id: 'db-id-123',
        tenantId: testTenantId,
        paymentId: testPaymentId,
        amount: 29900,
        currency: 'USD',
        source: 'opportunity-123',
        status: 'INITIATED',
        initiatedAt: new Date('2026-01-03T10:00:00Z'),
        externalReference: 'stripe-pi-123',
        correlationId: testCorrelationId,
        metadata: {},
        createdAt: new Date('2026-01-03T10:00:00Z'),
        updatedAt: new Date('2026-01-03T10:00:00Z'),
      };

      prismaMock.paymentRecord.findUnique.mockResolvedValue(mockPayment);

      const result = await repository.findById(testPaymentId, testTenantId);

      expect(prismaMock.paymentRecord.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_paymentId: {
            tenantId: testTenantId,
            paymentId: testPaymentId,
          },
        },
      });

      expect(result?.paymentId).toBe(testPaymentId);
    });

    it('should return null when payment not found', async () => {
      prismaMock.paymentRecord.findUnique.mockResolvedValue(null);

      const result = await repository.findById(testPaymentId, testTenantId);

      expect(result).toBeNull();
    });
  });

  describe('markPaidVerifiedAtomic', () => {
    it('should atomically update payment to PAID status', async () => {
      const mockExistingPayment = {
        id: 'db-id-123',
        tenantId: testTenantId,
        paymentId: testPaymentId,
        amount: 29900,
        currency: 'USD',
        source: 'opportunity-123',
        status: 'INITIATED',
        initiatedAt: new Date('2026-01-03T10:00:00Z'),
        correlationId: testCorrelationId,
        version: 1,
      };

      const mockUpdatedPayment = {
        ...mockExistingPayment,
        status: 'PAID',
        verifiedAt: expect.any(Date),
        verifiedBy: 'webhook-stripe',
        verificationMethod: 'webhook',
        correlationId: testCorrelationId,
        version: 2,
      };

      prismaMock.paymentRecord.findUnique.mockResolvedValue(
        mockExistingPayment
      );
      prismaMock.paymentRecord.update.mockResolvedValue(mockUpdatedPayment);
      prismaMock.$transaction.mockImplementation(async fn => fn(mockPrisma));

      const result = await repository.markPaidVerifiedAtomic(
        testPaymentId,
        testTenantId,
        'webhook-stripe',
        'webhook',
        testCorrelationId
      );

      expect(result.status).toBe('PAID');
      expect(result.verifiedAt).toBeDefined();
      expect(result.verifiedBy).toBe('webhook-stripe');
      expect(result.verificationMethod).toBe('webhook');
    });

    it('should throw error if payment not in INITIATED status', async () => {
      const mockExistingPayment = {
        id: 'db-id-123',
        tenantId: testTenantId,
        paymentId: testPaymentId,
        status: 'PAID', // Already paid
        version: 1,
      };

      prismaMock.paymentRecord.findUnique.mockResolvedValue(
        mockExistingPayment
      );
      prismaMock.$transaction.mockImplementation(async fn => fn(mockPrisma));

      await expect(
        repository.markPaidVerifiedAtomic(
          testPaymentId,
          testTenantId,
          'webhook-stripe',
          'webhook',
          testCorrelationId
        )
      ).rejects.toThrow('Payment payment-123 is not in INITIATED status');
    });
  });

  describe('findByEvidence', () => {
    it('should find payment by provider event ID', async () => {
      const mockPayment = {
        id: 'db-id-123',
        tenantId: testTenantId,
        paymentId: testPaymentId,
        status: 'INITIATED',
      };

      prismaMock.paymentRecord.findUnique.mockResolvedValue(mockPayment);

      const result = await repository.findByEvidence(
        testTenantId,
        'stripe',
        'evt_1234567890'
      );

      expect(prismaMock.paymentRecord.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_providerId_providerEventId: {
            tenantId: testTenantId,
            providerId: 'stripe',
            providerEventId: 'evt_1234567890',
          },
        },
      });

      expect(result?.paymentId).toBe(testPaymentId);
    });

    it('should find payment by external reference', async () => {
      const mockPayment = {
        id: 'db-id-123',
        tenantId: testTenantId,
        paymentId: testPaymentId,
        status: 'INITIATED',
      };

      prismaMock.paymentRecord.findFirst.mockResolvedValue(mockPayment);

      const result = await repository.findByEvidence(
        testTenantId,
        undefined,
        undefined,
        'stripe-pi-123'
      );

      expect(result?.paymentId).toBe(testPaymentId);
    });
  });

  describe('queryPayments', () => {
    it('should return paginated payment results', async () => {
      const mockPayments = [
        {
          id: 'db-id-1',
          tenantId: testTenantId,
          paymentId: 'payment-1',
          amount: 29900,
          currency: 'USD',
          status: 'PAID',
          source: 'opp-1',
        },
        {
          id: 'db-id-2',
          tenantId: testTenantId,
          paymentId: 'payment-2',
          amount: 49900,
          currency: 'USD',
          status: 'INITIATED',
          source: 'opp-2',
        },
      ];

      prismaMock.paymentRecord.findMany.mockResolvedValue(mockPayments);
      prismaMock.paymentRecord.count.mockResolvedValue(2);

      const result = await repository.queryPayments(testTenantId, {
        status: 'PAID',
        limit: 10,
        offset: 0,
      });

      expect(result.total).toBe(2);
      expect(result.payments).toHaveLength(2);
      expect(result.payments[0].status).toBe('PAID');
    });
  });

  describe('getPaymentStats', () => {
    it('should return payment statistics for tenant', async () => {
      const mockStats = [
        { status: 'PAID', _count: { status: 5 }, _sum: { amount: 149500 } },
        { status: 'FAILED', _count: { status: 2 }, _sum: { amount: 0 } },
      ];

      prismaMock.paymentRecord.groupBy.mockResolvedValue(mockStats);

      const stats = await repository.getPaymentStats(testTenantId);

      expect(stats.totalPayments).toBe(7);
      expect(stats.paidPayments).toBe(5);
      expect(stats.totalRevenue).toBe(149500);
      expect(stats.failedPayments).toBe(2);
    });
  });
});
