/**
 * Entitlement Evaluator Tests - WI-040: Billing & Entitlements Authority
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntitlementEvaluator } from '../entitlement-evaluator';
import { EnforcementMode, UsageType } from '../types';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    usageMeter: {
      upsert: vi.fn(),
    },
  })),
}));

describe('EntitlementEvaluator', () => {
  let evaluator: EntitlementEvaluator;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      usageMeter: {
        upsert: vi.fn(),
      },
    };
    evaluator = new EntitlementEvaluator(mockPrisma, EnforcementMode.BLOCK);
  });

  describe('checkEntitlement - MONITOR_ONLY mode', () => {
    beforeEach(() => {
      evaluator = new EntitlementEvaluator(
        mockPrisma,
        EnforcementMode.MONITOR_ONLY
      );
    });

    it('should allow usage even when over limit', async () => {
      mockPrisma.usageMeter.upsert.mockResolvedValue({ totalQuantity: 150 }); // Over 100 limit

      const result = await evaluator.checkEntitlement({
        tenantId: 'tenant_1',
        usageType: UsageType.EXECUTION,
        quantity: 10,
        correlationId: 'corr_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Monitor mode');
      expect(result.currentUsage).toBe(150);
      expect(result.limit).toBe(100);
      expect(result.remainingQuota).toBe(-50);
    });
  });

  describe('checkEntitlement - BLOCK mode', () => {
    beforeEach(() => {
      evaluator = new EntitlementEvaluator(mockPrisma, EnforcementMode.BLOCK);
    });

    it('should allow usage within limits', async () => {
      mockPrisma.usageMeter.upsert.mockResolvedValue({ totalQuantity: 50 });

      const result = await evaluator.checkEntitlement({
        tenantId: 'tenant_1',
        usageType: UsageType.EXECUTION,
        quantity: 10,
        correlationId: 'corr_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Within limits');
      expect(result.currentUsage).toBe(50);
      expect(result.limit).toBe(100);
      expect(result.remainingQuota).toBe(50);
    });

    it('should block usage over limits', async () => {
      mockPrisma.usageMeter.upsert.mockResolvedValue({ totalQuantity: 95 });

      const result = await evaluator.checkEntitlement({
        tenantId: 'tenant_1',
        usageType: UsageType.EXECUTION,
        quantity: 10,
        correlationId: 'corr_123',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Would exceed');
      expect(result.currentUsage).toBe(95);
      expect(result.limit).toBe(100);
      expect(result.remainingQuota).toBe(5);
    });
  });

  describe('checkEntitlement - GRACE_PERIOD mode', () => {
    beforeEach(() => {
      evaluator = new EntitlementEvaluator(
        mockPrisma,
        EnforcementMode.GRACE_PERIOD
      );
    });

    it('should allow usage even when over limit with warning', async () => {
      mockPrisma.usageMeter.upsert.mockResolvedValue({ totalQuantity: 150 });

      const result = await evaluator.checkEntitlement({
        tenantId: 'tenant_1',
        usageType: UsageType.EXECUTION,
        quantity: 10,
        correlationId: 'corr_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('Grace period');
      expect(result.currentUsage).toBe(150);
      expect(result.limit).toBe(100);
      expect(result.remainingQuota).toBe(-50);
    });
  });

  describe('checkEntitlement - Unlimited plans', () => {
    beforeEach(() => {
      evaluator = new EntitlementEvaluator(mockPrisma, EnforcementMode.BLOCK);
    });

    it('should allow unlimited voice minutes', async () => {
      const result = await evaluator.checkEntitlement({
        tenantId: 'tenant_1',
        usageType: UsageType.VOICE_MINUTE,
        quantity: 1000,
        correlationId: 'corr_123',
      });

      expect(result.allowed).toBe(true);
      expect(result.reason).toBe('Unlimited plan');
      expect(result.limit).toBe(-1);
      expect(result.remainingQuota).toBe(-1);
    });
  });

  describe('checkEntitlement - Error handling', () => {
    it('should fail closed on database errors', async () => {
      mockPrisma.usageMeter.upsert.mockRejectedValue(
        new Error('Database error')
      );

      const result = await evaluator.checkEntitlement({
        tenantId: 'tenant_1',
        usageType: UsageType.EXECUTION,
        quantity: 1,
        correlationId: 'corr_123',
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Billing system error');
    });
  });
});
