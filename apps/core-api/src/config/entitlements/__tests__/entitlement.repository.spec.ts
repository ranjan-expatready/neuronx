/**
 * Entitlement Repository Tests - WI-010: Entitlement Persistence
 *
 * Tests for PostgreSQL-backed entitlement repository with ACID transactions.
 * Verifies tier management, tenant entitlements, and scheduled actions.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementRepository } from '../entitlement.repository';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
const mockPrisma = {
  entitlementTier: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  tenantEntitlement: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  tierTransition: {
    create: jest.fn(),
    update: jest.fn(),
  },
  scheduledAction: {
    findMany: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('EntitlementRepository', () => {
  let repository: EntitlementRepository;
  let prismaMock: any;

  const testTenantId = 'test-tenant-123';
  const testTierId = 'professional';
  const testActorId = 'user-456';
  const testCorrelationId = 'corr-789';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementRepository,
        {
          provide: PrismaClient,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<EntitlementRepository>(EntitlementRepository);
    prismaMock = mockPrisma;

    // Reset mocks
    jest.clearAllMocks();

    // Setup transaction mock
    prismaMock.$transaction.mockImplementation(async fn => fn(prismaMock));
  });

  describe('initializeCanonicalTiers', () => {
    it('should initialize all canonical tiers', async () => {
      prismaMock.entitlementTier.upsert.mockResolvedValue({});

      await repository.initializeCanonicalTiers();

      expect(prismaMock.entitlementTier.upsert).toHaveBeenCalledTimes(4); // free, starter, professional, enterprise
      expect(prismaMock.entitlementTier.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tierId: 'free' },
          update: expect.any(Object),
          create: expect.objectContaining({ tierId: 'free', name: 'Free' }),
        })
      );
    });
  });

  describe('getTier', () => {
    it('should return tier when found', async () => {
      const mockTier = {
        tierId: testTierId,
        name: 'Professional',
        category: 'paid',
        isActive: true,
        features: {},
        limits: {},
        metadata: {},
        createdAt: new Date('2026-01-03T10:00:00Z'),
        updatedAt: new Date('2026-01-03T10:00:00Z'),
      };

      prismaMock.entitlementTier.findUnique.mockResolvedValue(mockTier);

      const result = await repository.getTier(testTierId);

      expect(result?.tierId).toBe(testTierId);
      expect(result?.name).toBe('Professional');
    });

    it('should return null when tier not found', async () => {
      prismaMock.entitlementTier.findUnique.mockResolvedValue(null);

      const result = await repository.getTier(testTierId);

      expect(result).toBeNull();
    });
  });

  describe('getTenantEntitlement', () => {
    it('should return tenant entitlement with tier data', async () => {
      const mockEntitlement = {
        tenantId: testTenantId,
        tierId: testTierId,
        status: 'active',
        effectiveAt: new Date('2026-01-03T10:00:00Z'),
        voiceDisabled: false,
        slaFrozen: false,
        tier: {
          tierId: testTierId,
          name: 'Professional',
        },
      };

      prismaMock.tenantEntitlement.findUnique.mockResolvedValue(
        mockEntitlement
      );

      const result = await repository.getTenantEntitlement(testTenantId);

      expect(result?.tenantId).toBe(testTenantId);
      expect(result?.tierId).toBe(testTierId);
      expect(result?.status).toBe('active');
    });

    it('should return null when no entitlement exists', async () => {
      prismaMock.tenantEntitlement.findUnique.mockResolvedValue(null);

      const result = await repository.getTenantEntitlement(testTenantId);

      expect(result).toBeNull();
    });
  });

  describe('setTierImmediate', () => {
    it('should set tenant tier immediately with transition record', async () => {
      const mockTier = { tierId: testTierId };
      const mockEntitlement = {
        tenantId: testTenantId,
        tierId: testTierId,
        status: 'active',
        tier: mockTier,
      };

      prismaMock.entitlementTier.findUnique.mockResolvedValue(mockTier);
      prismaMock.tenantEntitlement.upsert.mockResolvedValue(mockEntitlement);

      const result = await repository.setTierImmediate(
        testTenantId,
        testTierId,
        testActorId,
        testCorrelationId
      );

      expect(result.tenantId).toBe(testTenantId);
      expect(result.tierId).toBe(testTierId);
      expect(result.status).toBe('active');

      expect(prismaMock.tierTransition.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: testTenantId,
          toTierId: testTierId,
          transitionType: 'upgrade',
          requestedBy: testActorId,
          status: 'effective',
        }),
      });
    });

    it('should throw error if tier does not exist', async () => {
      prismaMock.entitlementTier.findUnique.mockResolvedValue(null);

      await expect(
        repository.setTierImmediate(
          testTenantId,
          'nonexistent-tier',
          testActorId,
          testCorrelationId
        )
      ).rejects.toThrow('Tier nonexistent-tier not found');
    });
  });

  describe('requestTierTransition', () => {
    const transitionRequest = {
      toTierId: 'enterprise',
      reason: 'Business growth',
      transitionType: 'upgrade' as const,
      gracePeriodDays: 0,
    };

    it('should handle immediate upgrade transitions', async () => {
      const mockToTier = { tierId: 'enterprise' };
      const mockEntitlement = {
        tenantId: testTenantId,
        tierId: 'enterprise',
        status: 'active',
        tier: mockToTier,
      };

      prismaMock.entitlementTier.findUnique.mockResolvedValue(mockToTier);
      prismaMock.tenantEntitlement.findUnique.mockResolvedValue(null);
      prismaMock.tenantEntitlement.upsert.mockResolvedValue(mockEntitlement);

      const result = await repository.requestTierTransition(
        testTenantId,
        transitionRequest,
        testActorId,
        testCorrelationId
      );

      expect(result.transitionType).toBe('upgrade');
      expect(result.status).toBe('effective');
      expect(result.graceEndsAt).toBeUndefined();
    });

    it('should handle downgrade transitions with grace period', async () => {
      const downgradeRequest = {
        ...transitionRequest,
        transitionType: 'downgrade' as const,
        gracePeriodDays: 7,
      };

      const mockToTier = { tierId: 'starter' };
      const mockFromEntitlement = {
        tenantId: testTenantId,
        tierId: 'professional',
      };

      prismaMock.entitlementTier.findUnique.mockResolvedValue(mockToTier);
      prismaMock.tenantEntitlement.findUnique.mockResolvedValue(
        mockFromEntitlement
      );

      const result = await repository.requestTierTransition(
        testTenantId,
        downgradeRequest,
        testActorId,
        testCorrelationId
      );

      expect(result.transitionType).toBe('downgrade');
      expect(result.status).toBe('pending');
      expect(result.graceEndsAt).toBeDefined();

      // Should create scheduled actions
      expect(prismaMock.scheduledAction.create).toHaveBeenCalled();
    });

    it('should create scheduled actions for downgrade effects', async () => {
      const downgradeRequest = {
        ...transitionRequest,
        toTierId: 'free',
        transitionType: 'downgrade' as const,
        gracePeriodDays: 3,
      };

      prismaMock.entitlementTier.findUnique.mockResolvedValue({
        tierId: 'free',
      });
      prismaMock.tenantEntitlement.findUnique.mockResolvedValue({
        tenantId: testTenantId,
        tierId: 'professional',
      });

      await repository.requestTierTransition(
        testTenantId,
        downgradeRequest,
        testActorId,
        testCorrelationId
      );

      // Should create multiple scheduled actions (voice disable, SLA freeze, etc.)
      expect(prismaMock.scheduledAction.create).toHaveBeenCalledTimes(4);
      expect(prismaMock.scheduledAction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actionType: 'voice_disable',
          tenantId: testTenantId,
          tenantEntitlementId: testTenantId,
          correlationId: testCorrelationId,
        }),
      });
    });
  });

  describe('executeDueScheduledActions', () => {
    it('should execute due actions and mark them complete', async () => {
      const dueActions = [
        {
          id: 'action-1',
          actionType: 'voice_disable',
          tenantId: testTenantId,
        },
        {
          id: 'action-2',
          actionType: 'sla_freeze',
          tenantId: testTenantId,
        },
      ];

      prismaMock.scheduledAction.findMany.mockResolvedValue(dueActions);
      prismaMock.tenantEntitlement.update.mockResolvedValue({});

      const executedCount = await repository.executeDueScheduledActions();

      expect(executedCount).toBe(2);
      expect(prismaMock.scheduledAction.update).toHaveBeenCalledTimes(2);
      expect(prismaMock.tenantEntitlement.update).toHaveBeenCalledWith({
        where: { tenantId: testTenantId },
        data: { voiceDisabled: true },
      });
    });

    it('should handle action execution failures', async () => {
      const failingAction = {
        id: 'action-1',
        actionType: 'voice_disable',
        tenantId: testTenantId,
      };

      prismaMock.scheduledAction.findMany.mockResolvedValue([failingAction]);
      prismaMock.tenantEntitlement.update.mockRejectedValue(
        new Error('DB error')
      );

      const executedCount = await repository.executeDueScheduledActions();

      expect(executedCount).toBe(0); // Failed actions don't count as executed
      expect(prismaMock.scheduledAction.update).toHaveBeenCalledWith({
        where: { id: 'action-1' },
        data: {
          status: 'failed',
          errorMessage: 'DB error',
          retryCount: { increment: 1 },
        },
      });
    });

    it('should skip actions that are already executing', async () => {
      const executingAction = {
        id: 'action-1',
        actionType: 'voice_disable',
        tenantId: testTenantId,
        status: 'executing',
      };

      prismaMock.scheduledAction.findMany.mockResolvedValue([executingAction]);

      const executedCount = await repository.executeDueScheduledActions();

      expect(executedCount).toBe(0);
      expect(prismaMock.scheduledAction.update).not.toHaveBeenCalled();
    });
  });

  describe('getActiveOverrides', () => {
    it('should return active entitlement overrides', async () => {
      const mockOverrides = [
        {
          id: 'override-1',
          tenantId: testTenantId,
          entitlementType: 'leads',
          originalLimit: 100,
          overrideLimit: 200,
          expiresAt: new Date('2026-01-04T10:00:00Z'),
          overrideBy: testActorId,
        },
      ];

      prismaMock.entitlementOverride.findMany.mockResolvedValue(mockOverrides);

      const overrides = await repository.getActiveOverrides(testTenantId);

      expect(overrides).toHaveLength(1);
      expect(overrides[0].entitlementType).toBe('leads');
      expect(overrides[0].overrideLimit).toBe(200);
    });
  });

  describe('createOverride', () => {
    it('should create entitlement override with expiry', async () => {
      const overrideData = {
        entitlementType: 'api' as const,
        originalLimit: 1000,
        overrideLimit: 2000,
        overrideReason: 'emergency' as const,
        overrideBy: testActorId,
        expiresAt: '2026-01-04T10:00:00.000Z',
      };

      const mockCreated = {
        id: 'override-1',
        tenantId: testTenantId,
        ...overrideData,
        expiresAt: new Date(overrideData.expiresAt),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.entitlementOverride.create.mockResolvedValue(mockCreated);

      const result = await repository.createOverride(
        testTenantId,
        overrideData
      );

      expect(result.entitlementType).toBe('api');
      expect(result.overrideLimit).toBe(2000);
      expect(prismaMock.entitlementOverride.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: testTenantId,
          entitlementType: 'api',
          overrideLimit: 2000,
        }),
      });
    });
  });

  describe('listTiers', () => {
    it('should filter and paginate tiers', async () => {
      const mockTiers = [
        { tierId: 'starter', category: 'paid', isActive: true },
        { tierId: 'professional', category: 'paid', isActive: true },
      ];

      prismaMock.entitlementTier.findMany.mockResolvedValue(mockTiers);

      const result = await repository.listTiers({
        category: 'paid',
        isActive: true,
        offset: 0,
        limit: 10,
      });

      expect(result).toHaveLength(2);
      expect(prismaMock.entitlementTier.findMany).toHaveBeenCalledWith({
        where: { category: 'paid', isActive: true },
        skip: 0,
        take: 10,
        orderBy: { tierId: 'asc' },
      });
    });
  });
});
