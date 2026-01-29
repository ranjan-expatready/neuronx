import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UsageService } from '../usage.service';
import { EventBus } from '../../eventing';
import { UsageRepository } from '../usage.repository';
import { UsageEvent, UsageMetric } from '../usage.types';

describe('UsageService', () => {
  let service: UsageService;
  let mocks: any;

  beforeEach(() => {
    mocks = {
      eventBus: { publish: vi.fn() },
      usageRepository: {
        recordEvent: vi.fn(),
        queryAggregates: vi.fn(),
        queryEvents: vi.fn(),
      },
    };

    service = new UsageService(
      mocks.eventBus as unknown as EventBus,
      mocks.usageRepository as unknown as UsageRepository,
      { enabled: false } // Disable periodic processing for unit tests
    );

    // @ts-ignore
    service['aggregates'] = new Map();
    // @ts-ignore
    service['reports'] = [];
  });

  const mockEvent: UsageEvent = {
    eventId: 'e1',
    tenantId: 't1',
    metric: 'leads.processed' as UsageMetric,
    quantity: 1,
    timestamp: new Date().toISOString(),
    correlationId: 'c1',
    sourceService: 'test-service',
  };

  describe('recordUsage', () => {
    it('should record valid usage event', async () => {
      await service.recordUsage(mockEvent);

      expect(mocks.usageRepository.recordEvent).toHaveBeenCalledWith(mockEvent);
      expect(mocks.eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage.occurred',
          tenantId: 't1',
        })
      );
    });

    it('should ignore invalid usage event', async () => {
      const invalidEvent = { ...mockEvent, metric: '' as any };
      await service.recordUsage(invalidEvent);

      expect(mocks.usageRepository.recordEvent).not.toHaveBeenCalled();
      expect(mocks.eventBus.publish).not.toHaveBeenCalled();
    });

    it('should handle repository errors gracefully', async () => {
      mocks.usageRepository.recordEvent.mockRejectedValue(
        new Error('DB Error')
      );

      // Should not throw
      await expect(service.recordUsage(mockEvent)).resolves.toBeUndefined();
    });
  });

  describe('recordUsageBatch', () => {
    it('should process batch and update aggregates', async () => {
      const batch = {
        batchId: 'b1',
        events: [mockEvent, { ...mockEvent, eventId: 'e2' }],
        createdAt: new Date().toISOString(),
        status: 'pending' as const,
      };

      const result = await service.recordUsageBatch(batch);

      expect(result.eventsProcessed).toBe(2);
      expect(result.aggregatesUpdated).toBe(1);
      expect(batch.status).toBe('completed');
    });
  });

  describe('getUsageSummary', () => {
    it('should return metrics for tenant and period', async () => {
      const period = '2024-01';
      // @ts-ignore
      service['aggregates'].set('t1:2024-01', {
        tenantId: 't1',
        period: '2024-01',
        metrics: { 'leads.processed': 100 },
        eventCount: 10,
      });

      const summary = await service.getUsageSummary('t1', '2024-01');
      expect(summary['leads.processed']).toBe(100);
    });

    it('should return empty object if no data', async () => {
      const summary = await service.getUsageSummary('t1', '2099-01');
      expect(summary).toEqual({});
    });
  });
});
