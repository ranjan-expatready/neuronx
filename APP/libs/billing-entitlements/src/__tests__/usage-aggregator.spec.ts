/**
 * Usage Aggregator Tests - WI-040: Billing & Entitlements Authority
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageAggregator } from '../usage-aggregator';
import { UsageType } from '../types';

// Mock Prisma
vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn().mockImplementation(() => ({
    usageEvent: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
    usageMeter: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  })),
}));

describe('UsageAggregator', () => {
  let aggregator: UsageAggregator;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      usageEvent: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
      usageMeter: {
        upsert: vi.fn(),
        findMany: vi.fn(),
      },
    };
    aggregator = new UsageAggregator(mockPrisma);
  });

  describe('recordUsage', () => {
    it('should record usage event and update meter', async () => {
      const usageEvent = {
        eventId: 'event_123',
        tenantId: 'tenant_1',
        type: UsageType.EXECUTION,
        quantity: 5,
        correlationId: 'corr_123',
        metadata: { test: true },
        occurredAt: new Date('2024-01-15'),
      };

      mockPrisma.usageEvent.upsert.mockResolvedValue({});
      mockPrisma.usageMeter.upsert.mockResolvedValue({ totalQuantity: 15 });

      await aggregator.recordUsage(usageEvent);

      // Verify event recording
      expect(mockPrisma.usageEvent.upsert).toHaveBeenCalledWith({
        where: { eventId: 'event_123' },
        update: {},
        create: {
          eventId: 'event_123',
          tenantId: 'tenant_1',
          type: UsageType.EXECUTION,
          quantity: 5,
          correlationId: 'corr_123',
          metadata: { test: true },
          occurredAt: new Date('2024-01-15'),
        },
      });

      // Verify meter update
      expect(mockPrisma.usageMeter.upsert).toHaveBeenCalledWith({
        where: {
          tenantId_period_type: {
            tenantId: 'tenant_1',
            period: '2024-01',
            type: UsageType.EXECUTION,
          },
        },
        update: {
          totalQuantity: {
            increment: 5,
          },
          lastUpdated: expect.any(Date),
        },
        create: {
          tenantId: 'tenant_1',
          period: '2024-01',
          type: UsageType.EXECUTION,
          totalQuantity: 5,
          lastUpdated: expect.any(Date),
        },
      });
    });

    it('should handle idempotent event recording', async () => {
      // Event already exists - should not error
      mockPrisma.usageEvent.upsert.mockResolvedValue({});
      mockPrisma.usageMeter.upsert.mockResolvedValue({ totalQuantity: 10 });

      const usageEvent = {
        eventId: 'duplicate_event',
        tenantId: 'tenant_1',
        type: UsageType.VOICE_MINUTE,
        quantity: 3,
        correlationId: 'corr_456',
        occurredAt: new Date(),
      };

      await expect(aggregator.recordUsage(usageEvent)).resolves.not.toThrow();
    });
  });

  describe('getUsageSummary', () => {
    it('should return usage summary for current period', async () => {
      const meters = [
        { type: UsageType.EXECUTION, totalQuantity: 75 },
        { type: UsageType.VOICE_MINUTE, totalQuantity: 45 },
        { type: UsageType.EXPERIMENT, totalQuantity: 3 },
      ];

      mockPrisma.usageMeter.findMany.mockResolvedValue(meters);

      const summary = await aggregator.getUsageSummary({
        tenantId: 'tenant_1',
      });

      expect(summary.period).toMatch(/^\d{4}-\d{2}$/); // YYYY-MM format
      expect(summary.usage).toEqual({
        [UsageType.EXECUTION]: 75,
        [UsageType.VOICE_MINUTE]: 45,
        [UsageType.EXPERIMENT]: 3,
      });
      expect(summary.limits).toEqual({
        executionsPerMonth: 100,
        voiceMinutesPerMonth: 10,
        experimentsPerMonth: 1,
      });
    });

    it('should return usage summary for specific period', async () => {
      mockPrisma.usageMeter.findMany.mockResolvedValue([
        { type: UsageType.EXECUTION, totalQuantity: 50 },
      ]);

      const summary = await aggregator.getUsageSummary({
        tenantId: 'tenant_1',
        period: '2024-01',
      });

      expect(summary.period).toBe('2024-01');
      expect(summary.usage[UsageType.EXECUTION]).toBe(50);
    });

    it('should handle missing meters gracefully', async () => {
      mockPrisma.usageMeter.findMany.mockResolvedValue([]);

      const summary = await aggregator.getUsageSummary({
        tenantId: 'tenant_1',
      });

      expect(summary.usage).toEqual({
        [UsageType.EXECUTION]: 0,
        [UsageType.VOICE_MINUTE]: 0,
        [UsageType.EXPERIMENT]: 0,
      });
    });
  });

  describe('getUsageEvents', () => {
    it('should return usage events with proper formatting', async () => {
      const rawEvents = [
        {
          eventId: 'event_1',
          tenantId: 'tenant_1',
          type: UsageType.EXECUTION,
          quantity: 10,
          correlationId: 'corr_1',
          metadata: { test: true },
          occurredAt: new Date('2024-01-15'),
        },
      ];

      mockPrisma.usageEvent.findMany.mockResolvedValue(rawEvents);

      const events = await aggregator.getUsageEvents(
        'tenant_1',
        UsageType.EXECUTION,
        10,
        0
      );

      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({
        eventId: 'event_1',
        tenantId: 'tenant_1',
        type: UsageType.EXECUTION,
        quantity: 10,
        correlationId: 'corr_1',
        metadata: { test: true },
        occurredAt: new Date('2024-01-15'),
      });

      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant_1', type: UsageType.EXECUTION },
        orderBy: { occurredAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should handle filtering and pagination', async () => {
      mockPrisma.usageEvent.findMany.mockResolvedValue([]);

      await aggregator.getUsageEvents('tenant_1', undefined, 50, 100);

      expect(mockPrisma.usageEvent.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant_1' },
        orderBy: { occurredAt: 'desc' },
        take: 50,
        skip: 100,
      });
    });
  });
});
