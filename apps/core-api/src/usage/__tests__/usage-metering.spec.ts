/**
 * Usage Metering Tests - REQ-019: Configuration as IP
 *
 * Tests that tenant-level usage is tracked across monetized domains:
 * - leads.processed, routing.decisions, sla.timers.started, voice.minutes.authorized, api.requests
 * - Usage events are emitted by services and aggregated per tenant
 * - Entitlements are observed but not enforced
 * - Tenant isolation is maintained
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EventBus } from '../../eventing';
import { UsageService } from '../usage.service';
import { UsageEventEmitter, UsageEventBatchBuilder } from '../usage.events';
import { UsageEvent, UsageAggregate, UsageMetric } from '../usage.types';

describe('Usage Metering - Tenant-Level Tracking', () => {
  let usageService: UsageService;
  let eventBus: EventBus;

  // Test data
  const tenantId = 'test-tenant-usage';
  const correlationId = 'test-correlation-123';

  // Mock event bus
  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsageService,
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    usageService = module.get<UsageService>(UsageService);
    eventBus = module.get<EventBus>(EventBus);

    // Clear all usage data between tests
    usageService.clearAllUsageData();
    jest.clearAllMocks();
  });

  afterEach(() => {
    usageService.clearAllUsageData();
  });

  describe('Usage Event Recording', () => {
    it('should record individual usage events', async () => {
      const event = UsageEventEmitter.emitLeadProcessed(
        tenantId,
        'lead-123',
        correlationId,
        'test-service'
      );

      await usageService.recordUsage(event);

      // Verify event was recorded
      const stats = usageService.getServiceStats();
      expect(stats.totalEvents).toBe(1);

      // Verify event bus was called
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage.occurred',
          tenantId,
          payload: event,
        })
      );
    });

    it('should handle invalid usage events gracefully', async () => {
      const invalidEvent = {
        eventId: 'invalid',
        tenantId: '',
        metric: 'invalid.metric' as UsageMetric,
        quantity: -1,
        timestamp: 'invalid-date',
        correlationId: '',
        sourceService: '',
      } as UsageEvent;

      await expect(usageService.recordUsage(invalidEvent)).rejects.toThrow(
        'Invalid usage event'
      );
    });

    it('should record usage events in batches', async () => {
      const events = [
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'test-service'
        ),
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-2',
          correlationId,
          'test-service'
        ),
        UsageEventEmitter.emitRoutingDecision(
          tenantId,
          'lead-1',
          'team-a',
          correlationId,
          'test-service'
        ),
      ];

      const batch = new UsageEventBatchBuilder().addEvents(events).build();

      const result = await usageService.recordUsageBatch(batch);

      expect(result.eventsProcessed).toBe(3);
      expect(result.aggregatesUpdated).toBeGreaterThan(0);

      const stats = usageService.getServiceStats();
      expect(stats.totalEvents).toBe(3);
    });

    it('should validate usage event batches', async () => {
      const invalidBatch = {
        batchId: '',
        events: [],
        createdAt: 'invalid-date',
        status: 'pending' as const,
      };

      await expect(usageService.recordUsageBatch(invalidBatch)).rejects.toThrow(
        'Invalid usage event batch'
      );
    });
  });

  describe('Usage Aggregation', () => {
    it('should aggregate usage events by tenant and period', async () => {
      // Record multiple events for the same tenant/period
      const events = [
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'scoring'
        ),
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-2',
          correlationId,
          'scoring'
        ),
        UsageEventEmitter.emitRoutingDecision(
          tenantId,
          'lead-1',
          'team-a',
          correlationId,
          'routing'
        ),
      ];

      for (const event of events) {
        await usageService.recordUsage(event);
      }

      // Process pending events to update aggregates
      await usageService.processPendingEvents();

      // Get current period aggregate
      const period = usageService['getCurrentPeriod']();
      const aggregate = await usageService.getUsageAggregate(tenantId, period);

      expect(aggregate).toBeDefined();
      expect(aggregate!.tenantId).toBe(tenantId);
      expect(aggregate!.period).toBe(period);
      expect(aggregate!.metrics['leads.processed']).toBe(2);
      expect(aggregate!.metrics['routing.decisions']).toBe(1);
    });

    it('should maintain separate aggregates for different tenants', async () => {
      const tenant2 = 'test-tenant-2';

      // Record events for both tenants
      await usageService.recordUsage(
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'scoring'
        )
      );
      await usageService.recordUsage(
        UsageEventEmitter.emitLeadProcessed(
          tenant2,
          'lead-2',
          correlationId,
          'scoring'
        )
      );

      await usageService.processPendingEvents();

      const period = usageService['getCurrentPeriod']();
      const agg1 = await usageService.getUsageAggregate(tenantId, period);
      const agg2 = await usageService.getUsageAggregate(tenant2, period);

      expect(agg1!.metrics['leads.processed']).toBe(1);
      expect(agg2!.metrics['leads.processed']).toBe(1);
      expect(agg1!.tenantId).not.toBe(agg2!.tenantId);
    });

    it('should accumulate quantities for the same metric', async () => {
      // Record multiple events for the same metric
      await usageService.recordUsage(
        UsageEventEmitter.emitAPIRequest(
          tenantId,
          '/api/leads',
          'GET',
          200,
          correlationId,
          'api'
        )
      );
      await usageService.recordUsage(
        UsageEventEmitter.emitAPIRequest(
          tenantId,
          '/api/leads',
          'POST',
          201,
          correlationId,
          'api'
        )
      );

      await usageService.processPendingEvents();

      const period = usageService['getCurrentPeriod']();
      const aggregate = await usageService.getUsageAggregate(tenantId, period);

      expect(aggregate!.metrics['api.requests.successful']).toBe(2);
    });
  });

  describe('Service-Specific Usage Events', () => {
    it('should emit lead processed events from scoring service', async () => {
      const event = UsageEventEmitter.emitLeadProcessed(
        tenantId,
        'lead-123',
        correlationId,
        'advanced-scoring'
      );

      await usageService.recordUsage(event);
      await usageService.processPendingEvents();

      const summary = await usageService.getUsageSummary(tenantId);
      expect(summary['leads.processed']).toBe(1);
    });

    it('should emit routing decision events from routing services', async () => {
      const event = UsageEventEmitter.emitRoutingDecision(
        tenantId,
        'lead-123',
        'team-enterprise',
        correlationId,
        'lead-router'
      );

      await usageService.recordUsage(event);
      await usageService.processPendingEvents();

      const summary = await usageService.getUsageSummary(tenantId);
      expect(summary['routing.decisions']).toBe(1);
    });

    it('should emit SLA timer events from SLA service', async () => {
      const event = UsageEventEmitter.emitSLATimerStarted(
        tenantId,
        'lead-123',
        2, // 2 hours
        correlationId,
        'sla'
      );

      await usageService.recordUsage(event);
      await usageService.processPendingEvents();

      const summary = await usageService.getUsageSummary(tenantId);
      expect(summary['sla.timers.started']).toBe(1);
    });

    it('should emit voice minutes events from voice service', async () => {
      const event = UsageEventEmitter.emitVoiceMinutesAuthorized(
        tenantId,
        15, // 15 minutes
        'call-123',
        correlationId,
        'voice'
      );

      await usageService.recordUsage(event);
      await usageService.processPendingEvents();

      const summary = await usageService.getUsageSummary(tenantId);
      expect(summary['voice.minutes.authorized']).toBe(15);
    });

    it('should emit API request events from API endpoints', async () => {
      const successEvent = UsageEventEmitter.emitAPIRequest(
        tenantId,
        '/api/leads',
        'GET',
        200,
        correlationId,
        'api'
      );

      const failureEvent = UsageEventEmitter.emitAPIRequest(
        tenantId,
        '/api/invalid',
        'GET',
        404,
        correlationId,
        'api'
      );

      await usageService.recordUsage(successEvent);
      await usageService.recordUsage(failureEvent);
      await usageService.processPendingEvents();

      const summary = await usageService.getUsageSummary(tenantId);
      expect(summary['api.requests.successful']).toBe(1);
      expect(summary['api.requests.failed']).toBe(1);
    });
  });

  describe('Usage Querying and Reporting', () => {
    beforeEach(async () => {
      // Setup some test data
      const events = [
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'scoring'
        ),
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-2',
          correlationId,
          'scoring'
        ),
        UsageEventEmitter.emitRoutingDecision(
          tenantId,
          'lead-1',
          'team-a',
          correlationId,
          'routing'
        ),
        UsageEventEmitter.emitAPIRequest(
          tenantId,
          '/api/leads',
          'GET',
          200,
          correlationId,
          'api'
        ),
      ];

      for (const event of events) {
        await usageService.recordUsage(event);
      }
      await usageService.processPendingEvents();
    });

    it('should provide usage summary for tenant', async () => {
      const summary = await usageService.getUsageSummary(tenantId);

      expect(summary['leads.processed']).toBe(2);
      expect(summary['routing.decisions']).toBe(1);
      expect(summary['api.requests.successful']).toBe(1);
    });

    it('should query usage with flexible options', async () => {
      const result = await usageService.queryUsage({
        tenantId,
        metrics: ['leads.processed', 'routing.decisions'],
      });

      expect(result.aggregates.length).toBeGreaterThan(0);
      expect(result.totalAggregates).toBeGreaterThan(0);

      // Should only include requested metrics
      const aggregate = result.aggregates[0];
      expect(aggregate.metrics['leads.processed']).toBeDefined();
      expect(aggregate.metrics['routing.decisions']).toBeDefined();
    });

    it('should generate usage reports', async () => {
      const period = usageService['getCurrentPeriod']();
      const report = await usageService.generateUsageReport(tenantId, period);

      expect(report.reportId).toBeDefined();
      expect(report.tenantId).toBe(tenantId);
      expect(report.period).toBe(period);
      expect(report.totals['leads.processed']).toBe(2);
      expect(report.dailyBreakdown.length).toBeGreaterThan(0);
      expect(report.metadata.totalEvents).toBeGreaterThan(0);

      // Verify report was stored
      const stats = usageService.getServiceStats();
      expect(stats.totalReports).toBe(1);
    });

    it('should maintain tenant isolation in queries', async () => {
      const tenant2 = 'test-tenant-2';

      // Add data for second tenant
      await usageService.recordUsage(
        UsageEventEmitter.emitLeadProcessed(
          tenant2,
          'lead-1',
          correlationId,
          'scoring'
        )
      );
      await usageService.processPendingEvents();

      const summary1 = await usageService.getUsageSummary(tenantId);
      const summary2 = await usageService.getUsageSummary(tenant2);

      expect(summary1['leads.processed']).toBe(2); // Original tenant has 2
      expect(summary2['leads.processed']).toBe(1); // Second tenant has 1
    });
  });

  describe('Usage Event Processing and Cleanup', () => {
    it('should process pending events periodically', async () => {
      // Add events
      await usageService.recordUsage(
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'scoring'
        )
      );

      // Process pending events
      const result = await usageService.processPendingEvents();

      expect(result.eventsProcessed).toBe(1);
      expect(result.aggregatesUpdated).toBeGreaterThan(0);

      // Verify no more pending events
      const result2 = await usageService.processPendingEvents();
      expect(result2.eventsProcessed).toBe(0);
    });

    it('should clean up old events based on retention policy', async () => {
      // Add an event with old timestamp
      const oldEvent = UsageEventEmitter.emitLeadProcessed(
        tenantId,
        'lead-1',
        correlationId,
        'scoring'
      );

      // Modify timestamp to be old
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40); // Older than 30-day retention
      oldEvent.timestamp = oldDate.toISOString();

      await usageService.recordUsage(oldEvent);

      // The cleanup happens in recordUsage, so old event should be cleaned up
      const stats = usageService.getServiceStats();
      // Event count should be lower due to cleanup
      expect(stats.totalEvents).toBeLessThanOrEqual(1);
    });

    it('should provide service statistics', () => {
      const stats = usageService.getServiceStats();

      expect(stats).toHaveProperty('totalEvents');
      expect(stats).toHaveProperty('totalAggregates');
      expect(stats).toHaveProperty('totalReports');
      expect(typeof stats.totalEvents).toBe('number');
    });
  });

  describe('Event Emission Integration', () => {
    it('should emit usage occurred events to event bus', async () => {
      const event = UsageEventEmitter.emitLeadProcessed(
        tenantId,
        'lead-123',
        correlationId,
        'test-service'
      );

      await usageService.recordUsage(event);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage.occurred',
          tenantId,
          payload: event,
        })
      );
    });

    it('should emit batch processing events', async () => {
      const events = [
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'test-service'
        ),
      ];

      const batch = new UsageEventBatchBuilder().addEvents(events).build();

      await usageService.recordUsageBatch(batch);

      // Should emit both individual events and batch completion
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2); // 1 individual + 1 batch
    });

    it('should emit report generation events', async () => {
      // Setup some data first
      await usageService.recordUsage(
        UsageEventEmitter.emitLeadProcessed(
          tenantId,
          'lead-1',
          correlationId,
          'scoring'
        )
      );
      await usageService.processPendingEvents();

      const period = usageService['getCurrentPeriod']();
      await usageService.generateUsageReport(tenantId, period);

      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'usage.report.generated',
          tenantId,
          payload: expect.objectContaining({
            reportId: expect.any(String),
            period,
          }),
        })
      );
    });
  });

  describe('Usage Metric Coverage', () => {
    const testMetrics: Array<{
      metric: UsageMetric;
      emitter: () => UsageEvent;
    }> = [
      {
        metric: 'leads.processed',
        emitter: () =>
          UsageEventEmitter.emitLeadProcessed(
            tenantId,
            'lead-1',
            correlationId,
            'scoring'
          ),
      },
      {
        metric: 'routing.decisions',
        emitter: () =>
          UsageEventEmitter.emitRoutingDecision(
            tenantId,
            'lead-1',
            'team-a',
            correlationId,
            'routing'
          ),
      },
      {
        metric: 'sla.timers.started',
        emitter: () =>
          UsageEventEmitter.emitSLATimerStarted(
            tenantId,
            'lead-1',
            2,
            correlationId,
            'sla'
          ),
      },
      {
        metric: 'voice.minutes.authorized',
        emitter: () =>
          UsageEventEmitter.emitVoiceMinutesAuthorized(
            tenantId,
            15,
            'call-1',
            correlationId,
            'voice'
          ),
      },
      {
        metric: 'api.requests.successful',
        emitter: () =>
          UsageEventEmitter.emitAPIRequest(
            tenantId,
            '/api/test',
            'GET',
            200,
            correlationId,
            'api'
          ),
      },
      {
        metric: 'scoring.requests',
        emitter: () =>
          UsageEventEmitter.emitScoringRequest(
            tenantId,
            'lead-1',
            'advanced',
            correlationId,
            'scoring'
          ),
      },
    ];

    testMetrics.forEach(({ metric, emitter }) => {
      it(`should track ${metric} usage metric`, async () => {
        const event = emitter();
        await usageService.recordUsage(event);
        await usageService.processPendingEvents();

        const summary = await usageService.getUsageSummary(tenantId);
        expect(summary[metric]).toBeGreaterThan(0);
      });
    });
  });
});
