/**
 * Durable Event Streaming Tests - WI-014: Durable Event Streaming
 *
 * Tests for outbox-based event publishing with multi-instance safety,
 * tenant isolation, and idempotency.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { OutboxRepository } from '../outbox.repository';
import { DurableEventPublisherService } from '../durable-event-publisher';
import { OutboxDispatcher, NoopEventTransport } from '../outbox-dispatcher';

// Mock Prisma
const mockPrisma = {
  outboxEvent: {
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  $queryRaw: jest.fn(),
  $transaction: jest.fn(),
};

describe('Durable Event Streaming (WI-014)', () => {
  let outboxRepository: OutboxRepository;
  let durableEventPublisher: DurableEventPublisherService;
  let outboxDispatcher: OutboxDispatcher;
  let eventTransport: NoopEventTransport;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const correlationId = 'corr-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboxRepository,
        DurableEventPublisherService,
        OutboxDispatcher,
        NoopEventTransport,
        {
          provide: 'EventTransport',
          useExisting: NoopEventTransport,
        },
      ],
    }).compile();

    outboxRepository = module.get<OutboxRepository>(OutboxRepository);
    durableEventPublisher = module.get<DurableEventPublisherService>(
      DurableEventPublisherService
    );
    outboxDispatcher = module.get<OutboxDispatcher>(OutboxDispatcher);
    eventTransport = module.get<NoopEventTransport>(NoopEventTransport);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockPrisma.outboxEvent.create.mockResolvedValue({ id: 'event-1' });
    mockPrisma.$queryRaw.mockResolvedValue([]);
    mockPrisma.$transaction.mockImplementation(async fn => fn(mockPrisma));
  });

  describe('Outbox Repository', () => {
    describe('storeEvent', () => {
      it('should store event successfully', async () => {
        const eventData = {
          tenantId: tenantA,
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          idempotencyKey: 'unique-key',
          sourceService: 'payment-service',
        };

        await outboxRepository.storeEvent(eventData);

        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: tenantA,
            eventId: 'event-1',
            eventType: 'payment.paid',
            correlationId,
            idempotencyKey: 'unique-key',
          }),
        });
      });

      it('should handle duplicate events idempotently', async () => {
        // Setup mock to simulate unique constraint violation
        mockPrisma.outboxEvent.create.mockRejectedValueOnce({
          code: 'P2002',
          meta: { target: ['tenantId', 'idempotencyKey'] },
        });

        const eventData = {
          tenantId: tenantA,
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          idempotencyKey: 'duplicate-key',
          sourceService: 'payment-service',
        };

        // Should not throw
        await expect(
          outboxRepository.storeEvent(eventData)
        ).resolves.not.toThrow();

        // Should have attempted to create once
        expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('claimPendingEvents', () => {
      it('should claim events with SKIP LOCKED for multi-instance safety', async () => {
        const mockEvents = [
          {
            id: 'event-1',
            tenantId: tenantA,
            eventId: 'test-1',
            eventType: 'payment.paid',
            payload: { amount: 100 },
            correlationId,
            attempts: 0,
            nextAttemptAt: new Date(),
            sourceService: 'payment-service',
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockEvents);

        const events = await outboxRepository.claimPendingEvents(10);

        expect(events).toHaveLength(1);
        expect(events[0].id).toBe('event-1');
        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });

      it('should return empty array when no events to claim', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        const events = await outboxRepository.claimPendingEvents(10);

        expect(events).toEqual([]);
      });
    });

    describe('Tenant Isolation', () => {
      it('should only return events for requested tenant in queries', async () => {
        const tenantAEvents = [
          { id: 'a-1', tenantId: tenantA, eventType: 'payment.paid' },
        ];

        const tenantBEvents = [
          { id: 'b-1', tenantId: tenantB, eventType: 'payment.paid' },
        ];

        mockPrisma.outboxEvent.findMany.mockImplementation(args => {
          const tenantId = args.where.tenantId;
          return Promise.resolve(
            tenantId === tenantA ? tenantAEvents : tenantBEvents
          );
        });

        const resultA = await outboxRepository.queryEventsByCorrelation(
          tenantA,
          correlationId
        );
        const resultB = await outboxRepository.queryEventsByCorrelation(
          tenantB,
          correlationId
        );

        expect(resultA).toHaveLength(1);
        expect(resultA[0].tenantId).toBe(tenantA);
        expect(resultB).toHaveLength(1);
        expect(resultB[0].tenantId).toBe(tenantB);
      });
    });
  });

  describe('Durable Event Publisher', () => {
    describe('publishInTransaction', () => {
      it('should store event within transaction', async () => {
        const eventData = {
          tenantId: tenantA,
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          sourceService: 'payment-service',
        };

        const mockTransaction = {
          outboxEvent: {
            create: jest.fn().mockResolvedValue({ id: 'event-1' }),
          },
        };

        await durableEventPublisher.publishInTransaction(
          eventData,
          mockTransaction as any
        );

        expect(mockTransaction.outboxEvent.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: tenantA,
            eventId: 'event-1',
            eventType: 'payment.paid',
            correlationId,
          }),
        });
      });

      it('should handle transaction constraint violations', async () => {
        const eventData = {
          tenantId: tenantA,
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          sourceService: 'payment-service',
        };

        const mockTransaction = {
          outboxEvent: {
            create: jest.fn().mockRejectedValue({
              code: 'P2002',
              meta: { target: ['tenantId', 'idempotencyKey'] },
            }),
          },
        };

        // Should not throw - idempotent within transaction
        await expect(
          durableEventPublisher.publishInTransaction(
            eventData,
            mockTransaction as any
          )
        ).resolves.not.toThrow();
      });
    });

    describe('publishAsync', () => {
      it('should store event asynchronously', async () => {
        const eventData = {
          tenantId: tenantA,
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          sourceService: 'payment-service',
        };

        await durableEventPublisher.publishAsync(eventData);

        expect(mockPrisma.outboxEvent.create).toHaveBeenCalled();
      });

      it('should not throw on async publish failure', async () => {
        mockPrisma.outboxEvent.create.mockRejectedValue(new Error('DB error'));

        const eventData = {
          tenantId: tenantA,
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          sourceService: 'payment-service',
        };

        // Should not throw - async publishing failures don't break business logic
        await expect(
          durableEventPublisher.publishAsync(eventData)
        ).resolves.not.toThrow();
      });
    });
  });

  describe('Outbox Dispatcher', () => {
    describe('processPendingEvents', () => {
      it('should process claimed events and mark as published', async () => {
        const mockEvents = [
          {
            id: 'event-1',
            tenantId: tenantA,
            eventId: 'test-1',
            eventType: 'payment.paid',
            payload: { amount: 100 },
            correlationId,
            attempts: 0,
            nextAttemptAt: new Date(),
            sourceService: 'payment-service',
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockEvents);

        const processed = await outboxDispatcher.processNow();

        expect(processed).toBe(1);
        expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
          where: { id: 'event-1' },
          data: { status: 'PUBLISHED', publishedAt: expect.any(Date) },
        });
      });

      it('should handle event processing failures with retry logic', async () => {
        const mockEvents = [
          {
            id: 'event-1',
            tenantId: tenantA,
            eventId: 'test-1',
            eventType: 'payment.paid',
            payload: { amount: 100 },
            correlationId,
            attempts: 2, // Less than max attempts
            nextAttemptAt: new Date(),
            sourceService: 'payment-service',
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockEvents);

        // Make transport fail
        const mockTransport = module.get<NoopEventTransport>('EventTransport');
        mockTransport.publish = jest
          .fn()
          .mockRejectedValue(new Error('Transport failure'));

        const processed = await outboxDispatcher.processNow();

        expect(processed).toBe(0); // Failed events don't count as processed
        expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
          where: { id: 'event-1' },
          data: {
            status: 'FAILED',
            lastError: 'Transport publish failed: Transport failure',
            nextAttemptAt: expect.any(Date),
          },
        });
      });

      it('should mark events as dead letter after max retries', async () => {
        const mockEvents = [
          {
            id: 'event-1',
            tenantId: tenantA,
            eventId: 'test-1',
            eventType: 'payment.paid',
            payload: { amount: 100 },
            correlationId,
            attempts: 5, // At max attempts
            nextAttemptAt: new Date(),
            sourceService: 'payment-service',
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockEvents);

        // Make transport fail
        const mockTransport = module.get<NoopEventTransport>('EventTransport');
        mockTransport.publish = jest
          .fn()
          .mockRejectedValue(new Error('Transport failure'));

        const processed = await outboxDispatcher.processNow();

        expect(processed).toBe(0);
        expect(mockPrisma.outboxEvent.update).toHaveBeenCalledWith({
          where: { id: 'event-1' },
          data: {
            status: 'DEAD_LETTER',
            lastError: 'Transport publish failed: Transport failure',
          },
        });
      });
    });

    describe('Multi-Instance Safety', () => {
      it('should prevent concurrent execution', async () => {
        // Simulate dispatcher already running
        (outboxDispatcher as any).isRunning = true;

        const processed = await outboxDispatcher.processNow();

        expect(processed).toBe(0);
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('should use SKIP LOCKED for database-level concurrency control', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        await outboxDispatcher.processNow();

        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });
    });
  });

  describe('Event Transport', () => {
    describe('NoopEventTransport', () => {
      it('should publish events without error', async () => {
        const event = {
          id: 'event-1',
          tenantId: tenantA,
          eventId: 'test-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          correlationId,
          attempts: 0,
          nextAttemptAt: new Date(),
          sourceService: 'payment-service',
        };

        await expect(eventTransport.publish(event)).resolves.not.toThrow();
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should maintain event ordering and correlation', async () => {
      // Store multiple related events
      const event1 = {
        tenantId: tenantA,
        eventId: 'payment-initiated',
        eventType: 'payment.initiated',
        payload: { amount: 100 },
        correlationId,
        sourceService: 'payment-service',
      };

      const event2 = {
        tenantId: tenantA,
        eventId: 'payment-paid',
        eventType: 'payment.paid',
        payload: { amount: 100 },
        correlationId,
        sourceService: 'payment-service',
      };

      await outboxRepository.storeEvent(event1);
      await outboxRepository.storeEvent(event2);

      // Query by correlation ID should return both events
      const events = await outboxRepository.queryEventsByCorrelation(
        tenantA,
        correlationId
      );

      expect(events).toHaveLength(2);
      expect(events.map(e => e.eventType)).toEqual(
        expect.arrayContaining(['payment.initiated', 'payment.paid'])
      );
    });

    it('should support tenant-specific event statistics', async () => {
      const mockStats = {
        pending: 5,
        processing: 2,
        published: 100,
        failed: 1,
        deadLetter: 0,
        total: 108,
      };

      mockPrisma.outboxEvent.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { status: 5 } },
        { status: 'PROCESSING', _count: { status: 2 } },
        { status: 'PUBLISHED', _count: { status: 100 } },
        { status: 'FAILED', _count: { status: 1 } },
      ]);

      const stats = await outboxRepository.getEventStats();

      expect(stats.pending).toBe(5);
      expect(stats.processing).toBe(2);
      expect(stats.published).toBe(100);
      expect(stats.failed).toBe(1);
      expect(stats.total).toBe(108);
    });
  });
});
