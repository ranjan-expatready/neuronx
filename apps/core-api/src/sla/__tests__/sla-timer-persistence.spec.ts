/**
 * SLA Timer Persistence Tests - WI-017: SLA Timer Persistence
 *
 * Tests for durable SLA timer storage, multi-instance processing, and idempotency.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { SlaTimerRepository } from '../sla-timer.repository';
import { SlaTimerRunner } from '../sla-timer.runner';
import { DurableEventPublisherService } from '../../eventing/durable-event-publisher';
import { EscalationService } from '../escalation.service';

// Mock Prisma
const mockPrisma = {
  slaTimer: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
  },
  slaEscalationEvent: {
    create: jest.fn(),
    update: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

describe('SLA Timer Persistence (WI-017)', () => {
  let slaTimerRepository: SlaTimerRepository;
  let slaTimerRunner: SlaTimerRunner;
  let durableEventPublisher: DurableEventPublisherService;
  let escalationService: EscalationService;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const correlationId = 'corr-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaTimerRepository,
        SlaTimerRunner,
        {
          provide: DurableEventPublisherService,
          useValue: {
            publishAsync: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EscalationService,
          useValue: {
            handleEscalation: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    slaTimerRepository = module.get<SlaTimerRepository>(SlaTimerRepository);
    slaTimerRunner = module.get<SlaTimerRunner>(SlaTimerRunner);
    durableEventPublisher = module.get<DurableEventPublisherService>(
      DurableEventPublisherService
    );
    escalationService = module.get<EscalationService>(EscalationService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockPrisma.slaTimer.create.mockResolvedValue({ id: 'timer-1' });
    mockPrisma.slaEscalationEvent.create.mockResolvedValue({
      id: 'escalation-1',
    });
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  describe('SlaTimerRepository', () => {
    describe('createTimer', () => {
      it('should create timer successfully', async () => {
        const timerData = {
          tenantId: tenantA,
          leadId: 'lead-1',
          slaContractId: 'default-sla',
          startedAt: new Date(),
          dueAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
          slaWindowMinutes: 30,
          escalationSteps: [{ step: 1, delayHours: 24 }],
          correlationId,
          idempotencyKey: 'unique-key',
        };

        await slaTimerRepository.createTimer(timerData);

        expect(mockPrisma.slaTimer.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: tenantA,
            leadId: 'lead-1',
            slaContractId: 'default-sla',
            correlationId,
            idempotencyKey: 'unique-key',
          }),
        });
      });

      it('should handle duplicate timer creation idempotently', async () => {
        // Setup mock to simulate unique constraint violation
        mockPrisma.slaTimer.create.mockRejectedValueOnce({
          code: 'P2002',
          meta: {
            target: ['tenantId', 'leadId', 'slaContractId', 'startedAt'],
          },
        });

        const timerData = {
          tenantId: tenantA,
          leadId: 'lead-1',
          slaContractId: 'default-sla',
          startedAt: new Date(),
          dueAt: new Date(Date.now() + 30 * 60 * 1000),
          slaWindowMinutes: 30,
          escalationSteps: [],
          correlationId,
        };

        // Should not throw
        await expect(
          slaTimerRepository.createTimer(timerData)
        ).resolves.not.toThrow();

        // Should have attempted to create once
        expect(mockPrisma.slaTimer.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('cancelTimerForLead', () => {
      it('should cancel active timers for lead', async () => {
        mockPrisma.slaTimer.updateMany.mockResolvedValue({ count: 2 });

        const cancelled = await slaTimerRepository.cancelTimerForLead(
          tenantA,
          'lead-1',
          correlationId
        );

        expect(cancelled).toBe(2);
        expect(mockPrisma.slaTimer.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: tenantA,
            leadId: 'lead-1',
            status: { in: ['ACTIVE', 'PENDING'] },
          },
          data: {
            status: 'CANCELLED',
            updatedAt: expect.any(Date),
          },
        });
      });
    });

    describe('claimDueTimers', () => {
      it('should claim due timers with SKIP LOCKED for multi-instance safety', async () => {
        const mockTimers = [
          {
            id: 'timer-1',
            tenantId: tenantA,
            leadId: 'lead-1',
            slaContractId: 'default-sla',
            startedAt: new Date(),
            dueAt: new Date(),
            slaWindowMinutes: 30,
            escalationSteps: [],
            correlationId,
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

        const timers = await slaTimerRepository.claimDueTimers(10);

        expect(timers).toHaveLength(1);
        expect(timers[0].id).toBe('timer-1');
        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });

      it('should return empty array when no timers are due', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        const timers = await slaTimerRepository.claimDueTimers(10);

        expect(timers).toEqual([]);
      });
    });

    describe('Tenant Isolation', () => {
      it('should only return timers for requested tenant', async () => {
        const tenantATimers = [
          { id: 'a-1', tenantId: tenantA, leadId: 'lead-1' },
        ];

        const tenantBTimers = [
          { id: 'b-1', tenantId: tenantB, leadId: 'lead-1' },
        ];

        mockPrisma.slaTimer.findMany.mockImplementation(args => {
          const tenantId = args.where.tenantId;
          return Promise.resolve(
            tenantId === tenantA ? tenantATimers : tenantBTimers
          );
        });

        const resultA = await slaTimerRepository.queryActiveTimers(tenantA);
        const resultB = await slaTimerRepository.queryActiveTimers(tenantB);

        expect(resultA).toHaveLength(1);
        expect(resultA[0].tenantId).toBe(tenantA);
        expect(resultB).toHaveLength(1);
        expect(resultB[0].tenantId).toBe(tenantB);
      });

      it('should enforce tenant isolation in statistics', async () => {
        mockPrisma.slaTimer.groupBy.mockResolvedValue([
          { status: 'ACTIVE', _count: { status: 5 } },
          { status: 'COMPLETED', _count: { status: 3 } },
        ]);

        const stats = await slaTimerRepository.getTimerStats(tenantA);

        expect(mockPrisma.slaTimer.groupBy).toHaveBeenCalledWith({
          by: ['status'],
          where: { tenantId: tenantA },
          _count: { status: true },
        });
      });
    });
  });

  describe('SlaTimerRunner', () => {
    describe('processDueTimers', () => {
      it('should process claimed timers and execute escalations', async () => {
        const mockTimers = [
          {
            id: 'timer-1',
            tenantId: tenantA,
            leadId: 'lead-1',
            slaContractId: 'default-sla',
            startedAt: new Date(),
            dueAt: new Date(),
            slaWindowMinutes: 30,
            escalationSteps: [{ step: 1, delayHours: 24, actionType: 'task' }],
            correlationId,
            attempts: 0,
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

        const processed = await slaTimerRunner.processNow();

        expect(processed).toBe(1);

        // Should mark timer as completed
        expect(mockPrisma.slaTimer.update).toHaveBeenCalledWith({
          where: { id: 'timer-1' },
          data: {
            status: 'COMPLETED',
            processingStatus: 'COMPLETED',
            updatedAt: expect.any(Date),
          },
        });

        // Should publish SLA timer due event
        expect(durableEventPublisher.publishAsync).toHaveBeenCalledWith({
          tenantId: tenantA,
          eventId: 'sla-timer-due-timer-1',
          eventType: 'sla.timer.due',
          payload: expect.objectContaining({
            timerId: 'timer-1',
            leadId: 'lead-1',
            tenantId: tenantA,
          }),
          correlationId,
          idempotencyKey: 'sla-timer-due-timer-1',
          sourceService: 'sla-timer-runner',
        });

        // Should execute escalation
        expect(escalationService.handleEscalation).toHaveBeenCalledWith(
          tenantA,
          'default',
          'lead-1',
          'SLA timer due - step 1',
          correlationId
        );

        // Should mark timer as escalated
        expect(mockPrisma.slaTimer.update).toHaveBeenCalledWith({
          where: { id: 'timer-1' },
          data: {
            status: 'ESCALATED',
            processingStatus: 'COMPLETED',
            updatedAt: expect.any(Date),
          },
        });
      });

      it('should handle timer processing failures with retry logic', async () => {
        const mockTimers = [
          {
            id: 'timer-1',
            tenantId: tenantA,
            leadId: 'lead-1',
            slaContractId: 'default-sla',
            startedAt: new Date(),
            dueAt: new Date(),
            slaWindowMinutes: 30,
            escalationSteps: [],
            correlationId,
            attempts: 2, // Less than max attempts
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

        // Make timer update fail
        mockPrisma.slaTimer.update.mockRejectedValue(new Error('DB error'));

        const processed = await slaTimerRunner.processNow();

        expect(processed).toBe(0); // Failed timer doesn't count as processed
        expect(mockPrisma.slaTimer.update).toHaveBeenCalledWith({
          where: { id: 'timer-1' },
          data: {
            processingStatus: 'FAILED',
            lastError: 'DB error',
            nextAttemptAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        });
      });

      it('should mark timers as permanently failed after max retries', async () => {
        const mockTimers = [
          {
            id: 'timer-1',
            tenantId: tenantA,
            leadId: 'lead-1',
            slaContractId: 'default-sla',
            startedAt: new Date(),
            dueAt: new Date(),
            slaWindowMinutes: 30,
            escalationSteps: [],
            correlationId,
            attempts: 3, // At max attempts
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

        // Make timer update fail
        mockPrisma.slaTimer.update.mockRejectedValue(new Error('DB error'));

        const processed = await slaTimerRunner.processNow();

        expect(processed).toBe(0);
        expect(mockPrisma.slaTimer.update).toHaveBeenCalledWith({
          where: { id: 'timer-1' },
          data: {
            processingStatus: 'FAILED',
            lastError: 'DB error',
            nextAttemptAt: expect.any(Date),
            updatedAt: expect.any(Date),
          },
        });
      });
    });

    describe('Multi-Instance Safety', () => {
      it('should prevent concurrent execution', async () => {
        // Simulate runner already running
        (slaTimerRunner as any).isRunning = true;

        const processed = await slaTimerRunner.processNow();

        expect(processed).toBe(0);
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('should use SKIP LOCKED for database-level concurrency control', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        await slaTimerRunner.processNow();

        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });
    });
  });

  describe('Escalation Event Creation', () => {
    it('should create escalation events with idempotency', async () => {
      const eventData = {
        tenantId: tenantA,
        leadId: 'lead-1',
        timerId: 'timer-1',
        escalationStep: 1,
        escalationConfig: { actionType: 'task' },
        correlationId,
      };

      await slaTimerRepository.createEscalationEvent(eventData);

      expect(mockPrisma.slaEscalationEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: tenantA,
          leadId: 'lead-1',
          timerId: 'timer-1',
          escalationStep: 1,
          correlationId,
          idempotencyKey: 'timer-1-1',
        }),
      });
    });

    it('should handle duplicate escalation events idempotently', async () => {
      mockPrisma.slaEscalationEvent.create.mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['tenantId', 'timerId', 'escalationStep'] },
      });

      const eventData = {
        tenantId: tenantA,
        leadId: 'lead-1',
        timerId: 'timer-1',
        escalationStep: 1,
        escalationConfig: { actionType: 'task' },
        correlationId,
      };

      // Should not throw
      await expect(
        slaTimerRepository.createEscalationEvent(eventData)
      ).resolves.not.toThrow();
    });
  });

  describe('Event Publishing Integration', () => {
    it('should publish events durably via outbox pattern', async () => {
      const mockTimers = [
        {
          id: 'timer-1',
          tenantId: tenantA,
          leadId: 'lead-1',
          slaContractId: 'default-sla',
          startedAt: new Date(),
          dueAt: new Date(),
          slaWindowMinutes: 30,
          escalationSteps: [],
          correlationId,
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

      await slaTimerRunner.processNow();

      // Verify SLA timer due event was published
      expect(durableEventPublisher.publishAsync).toHaveBeenCalledWith({
        tenantId: tenantA,
        eventId: 'sla-timer-due-timer-1',
        eventType: 'sla.timer.due',
        payload: expect.objectContaining({
          timerId: 'timer-1',
          leadId: 'lead-1',
        }),
        correlationId,
        idempotencyKey: 'sla-timer-due-timer-1',
        sourceService: 'sla-timer-runner',
      });
    });

    it('should publish escalation triggered events', async () => {
      const mockTimers = [
        {
          id: 'timer-1',
          tenantId: tenantA,
          leadId: 'lead-1',
          slaContractId: 'default-sla',
          startedAt: new Date(),
          dueAt: new Date(),
          slaWindowMinutes: 30,
          escalationSteps: [{ step: 1, delayHours: 24, actionType: 'task' }],
          correlationId,
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

      await slaTimerRunner.processNow();

      // Verify escalation triggered event was published
      expect(durableEventPublisher.publishAsync).toHaveBeenCalledWith({
        tenantId: tenantA,
        eventId: 'sla-escalation-escalation-1',
        eventType: 'sla.escalation.triggered',
        payload: expect.objectContaining({
          timerId: 'timer-1',
          leadId: 'lead-1',
          escalationStep: 1,
        }),
        correlationId,
        idempotencyKey: 'sla-escalation-timer-1-1',
        sourceService: 'sla-timer-runner',
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive timer statistics', async () => {
      mockPrisma.slaTimer.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: { status: 5 } },
        { status: 'COMPLETED', _count: { status: 10 } },
        { status: 'CANCELLED', _count: { status: 2 } },
        { status: 'ESCALATED', _count: { status: 1 } },
      ]);

      const stats = await slaTimerRepository.getTimerStats();

      expect(stats.active).toBe(5);
      expect(stats.completed).toBe(10);
      expect(stats.cancelled).toBe(2);
      expect(stats.escalated).toBe(1);
      expect(stats.total).toBe(18);
    });

    it('should provide escalation statistics', async () => {
      mockPrisma.slaEscalationEvent.groupBy.mockResolvedValue([
        { outcome: 'SUCCESS', _count: { outcome: 8 } },
        { outcome: 'FAILED', _count: { outcome: 2 } },
      ]);

      const stats = await slaTimerRepository.getEscalationStats();

      expect(stats.successful).toBe(8);
      expect(stats.failed).toBe(2);
      expect(stats.total).toBe(10);
    });
  });

  describe('Restart Safety', () => {
    it('should handle service restart with persisted timers', async () => {
      // Simulate timers that were persisted before restart
      const mockTimers = [
        {
          id: 'timer-1',
          tenantId: tenantA,
          leadId: 'lead-1',
          slaContractId: 'default-sla',
          startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          dueAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (overdue)
          slaWindowMinutes: 30,
          escalationSteps: [],
          correlationId,
          attempts: 0,
          nextAttemptAt: new Date(),
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockTimers);

      // Process should handle the overdue timer correctly
      const processed = await slaTimerRunner.processNow();

      expect(processed).toBe(1);
      expect(mockPrisma.slaTimer.update).toHaveBeenCalledWith({
        where: { id: 'timer-1' },
        data: {
          status: 'COMPLETED',
          processingStatus: 'COMPLETED',
          updatedAt: expect.any(Date),
        },
      });
    });
  });
});
