/**
 * Voice Attempt Persistence Tests - WI-013: Voice State Persistence
 *
 * Tests for durable voice attempt tracking, multi-instance processing, and idempotency.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { VoiceAttemptRepository } from '../voice-attempt.repository';
import { VoiceAttemptRunner } from '../voice-attempt.runner';
import { VoiceService } from '../voice.service';
import { DurableEventPublisherService } from '../../eventing/durable-event-publisher';

// Mock Prisma
const mockPrisma = {
  voiceAttempt: {
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    groupBy: jest.fn(),
    deleteMany: jest.fn(),
  },
  voiceExecutionEvent: {
    create: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

describe('Voice Attempt Persistence (WI-013)', () => {
  let voiceAttemptRepository: VoiceAttemptRepository;
  let voiceAttemptRunner: VoiceAttemptRunner;
  let voiceService: VoiceService;
  let durableEventPublisher: DurableEventPublisherService;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const correlationId = 'corr-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAttemptRepository,
        VoiceAttemptRunner,
        {
          provide: VoiceService,
          useValue: {
            requestVoiceAction: jest.fn(),
            handleProviderWebhook: jest.fn(),
            linkAttemptToCase: jest.fn(),
          },
        },
        {
          provide: DurableEventPublisherService,
          useValue: {
            publishAsync: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    voiceAttemptRepository = module.get<VoiceAttemptRepository>(
      VoiceAttemptRepository
    );
    voiceAttemptRunner = module.get<VoiceAttemptRunner>(VoiceAttemptRunner);
    voiceService = module.get<VoiceService>(VoiceService);
    durableEventPublisher = module.get<DurableEventPublisherService>(
      DurableEventPublisherService
    );

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockPrisma.voiceAttempt.create.mockResolvedValue({ id: 'attempt-1' });
    mockPrisma.voiceExecutionEvent.create.mockResolvedValue({ id: 'event-1' });
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  describe('VoiceAttemptRepository', () => {
    describe('createAttempt', () => {
      it('should create attempt successfully', async () => {
        const attemptData = {
          tenantId: tenantA,
          attemptId: 'attempt-1',
          leadId: 'lead-1',
          intentType: 'outbound_call_inbound',
          correlationId,
          idempotencyKey: 'unique-key',
          provider: 'twilio',
          maxRetries: 3,
        };

        await voiceAttemptRepository.createAttempt(attemptData);

        expect(mockPrisma.voiceAttempt.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: tenantA,
            attemptId: 'attempt-1',
            leadId: 'lead-1',
            intentType: 'outbound_call_inbound',
            correlationId,
            idempotencyKey: 'unique-key',
            provider: 'twilio',
            maxRetries: 3,
          }),
        });
      });

      it('should handle duplicate attempt creation idempotently', async () => {
        // Setup mock to simulate unique constraint violation
        mockPrisma.voiceAttempt.create.mockRejectedValueOnce({
          code: 'P2002',
          meta: { target: ['tenantId', 'idempotencyKey'] },
        });

        const attemptData = {
          tenantId: tenantA,
          attemptId: 'attempt-1',
          leadId: 'lead-1',
          intentType: 'outbound_call_inbound',
          correlationId,
          idempotencyKey: 'duplicate-key',
          provider: 'twilio',
        };

        // Should not throw
        await expect(
          voiceAttemptRepository.createAttempt(attemptData)
        ).resolves.not.toThrow();

        // Should have attempted to create once
        expect(mockPrisma.voiceAttempt.create).toHaveBeenCalledTimes(1);
      });
    });

    describe('authorizeAttempt', () => {
      it('should authorize attempt with consent and payment refs', async () => {
        mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 1 });

        await voiceAttemptRepository.authorizeAttempt(
          tenantA,
          'attempt-1',
          'consent-123',
          'payment-456',
          correlationId
        );

        expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: tenantA,
            attemptId: 'attempt-1',
            status: { in: ['INITIATED', 'PENDING'] },
          },
          data: {
            status: 'AUTHORIZED',
            authorizedAt: expect.any(Date),
            consentRef: 'consent-123',
            paymentRef: 'payment-456',
            updatedAt: expect.any(Date),
          },
        });
      });
    });

    describe('updateFromProvider', () => {
      it('should update attempt from provider webhook (idempotent)', async () => {
        mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 1 });
        mockPrisma.voiceAttempt.findFirst.mockResolvedValue({
          id: 'attempt-1',
          attemptId: 'attempt-1',
        });

        const updateData = {
          tenantId: tenantA,
          provider: 'twilio',
          providerCallId: 'call-123',
          providerStatus: 'completed',
          durationSec: 120,
          recordingUrl: 'https://example.com/recording.mp3',
          transcriptRef: 'transcript-456',
          correlationId,
        };

        const attemptId =
          await voiceAttemptRepository.updateFromProvider(updateData);

        expect(attemptId).toBe('attempt-1');
        expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: tenantA,
            provider: 'twilio',
            providerCallId: 'call-123',
          },
          data: expect.objectContaining({
            providerStatus: 'completed',
            durationSec: 120,
            recordingUrl: 'https://example.com/recording.mp3',
            transcriptRef: 'transcript-456',
          }),
        });
      });

      it('should return null when no attempt found to update', async () => {
        mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 0 });

        const updateData = {
          tenantId: tenantA,
          provider: 'twilio',
          providerCallId: 'call-123',
          providerStatus: 'completed',
          correlationId,
        };

        const attemptId =
          await voiceAttemptRepository.updateFromProvider(updateData);

        expect(attemptId).toBeNull();
      });
    });

    describe('Tenant Isolation', () => {
      it('should only return attempts for requested tenant', async () => {
        const tenantAAttempts = [
          { id: 'a-1', tenantId: tenantA, leadId: 'lead-1' },
        ];

        const tenantBAttempts = [
          { id: 'b-1', tenantId: tenantB, leadId: 'lead-1' },
        ];

        mockPrisma.voiceAttempt.findMany.mockImplementation(args => {
          const tenantId = args.where.tenantId;
          return Promise.resolve(
            tenantId === tenantA ? tenantAAttempts : tenantBAttempts
          );
        });

        const resultA = await voiceAttemptRepository.queryAttemptsByLead(
          tenantA,
          'lead-1'
        );
        const resultB = await voiceAttemptRepository.queryAttemptsByLead(
          tenantB,
          'lead-1'
        );

        expect(resultA).toHaveLength(1);
        expect(resultA[0].tenantId).toBe(tenantA);
        expect(resultB).toHaveLength(1);
        expect(resultB[0].tenantId).toBe(tenantB);
      });

      it('should enforce tenant isolation in statistics', async () => {
        mockPrisma.voiceAttempt.groupBy.mockResolvedValue([
          { status: 'AUTHORIZED', _count: { status: 5 } },
          { status: 'COMPLETED', _count: { status: 3 } },
        ]);

        const stats = await voiceAttemptRepository.getAttemptStats(tenantA);

        expect(mockPrisma.voiceAttempt.groupBy).toHaveBeenCalledWith({
          by: ['status'],
          where: { tenantId: tenantA },
          _count: { status: true },
        });
      });
    });
  });

  describe('VoiceAttemptRunner', () => {
    describe('processFailedAttempts', () => {
      it('should process and retry failed attempts', async () => {
        const mockAttempts = [
          {
            id: 'attempt-1',
            tenantId: tenantA,
            attemptId: 'attempt-1',
            leadId: 'lead-1',
            intentType: 'outbound_call_inbound',
            correlationId,
            attempts: 2,
            maxRetries: 3,
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockAttempts);

        const processed = await voiceAttemptRunner.processNow();

        expect(processed).toBe(1);

        // Should publish retry event
        expect(durableEventPublisher.publishAsync).toHaveBeenCalledWith({
          tenantId: tenantA,
          eventId: expect.stringContaining('voice-retry-attempt-1'),
          eventType: 'voice.attempt.retry',
          payload: expect.objectContaining({
            attemptId: 'attempt-1',
            leadId: 'lead-1',
            retryAttempt: 2,
            maxRetries: 3,
          }),
          correlationId,
          idempotencyKey: 'voice-retry-attempt-1-2',
          sourceService: 'voice-attempt-runner',
        });

        // Should mark attempt as failed again (for actual retry logic)
        expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: tenantA,
            attemptId: 'attempt-1',
            status: { in: ['AUTHORIZED', 'EXECUTING'] },
          },
          data: expect.objectContaining({
            status: 'FAILED',
            lastError: expect.stringContaining('Retry attempt 2'),
          }),
        });
      });

      it('should return 0 when no failed attempts to process', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        const processed = await voiceAttemptRunner.processNow();

        expect(processed).toBe(0);
      });
    });

    describe('Multi-Instance Safety', () => {
      it('should prevent concurrent execution', async () => {
        // Simulate runner already running
        (voiceAttemptRunner as any).isRunning = true;

        const processed = await voiceAttemptRunner.processNow();

        expect(processed).toBe(0);
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('should use SKIP LOCKED for database-level concurrency control', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        await voiceAttemptRunner.processNow();

        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });
    });
  });

  describe('VoiceService Integration', () => {
    it('should create attempt record when voice action is authorized', async () => {
      // This would be tested in integration tests with the full VoiceService
      // For unit tests, we verify the repository methods are called correctly
      const attemptData = {
        tenantId: tenantA,
        attemptId: 'attempt-1',
        leadId: 'lead-1',
        intentType: 'outbound_call_inbound',
        correlationId,
        idempotencyKey: 'test-key',
        provider: 'twilio',
      };

      await voiceAttemptRepository.createAttempt(attemptData);

      expect(mockPrisma.voiceAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: tenantA,
          attemptId: 'attempt-1',
          leadId: 'lead-1',
          status: 'INITIATED', // Default status
        }),
      });
    });

    it('should handle provider webhook updates securely', async () => {
      mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.voiceAttempt.findFirst.mockResolvedValue({
        id: 'attempt-1',
        attemptId: 'attempt-1',
      });

      const updateData = {
        tenantId: tenantA,
        provider: 'twilio',
        providerCallId: 'call-123',
        providerStatus: 'completed',
        durationSec: 120,
        correlationId,
      };

      const attemptId =
        await voiceAttemptRepository.updateFromProvider(updateData);

      expect(attemptId).toBe('attempt-1');
      // Verify status mapping (provider status doesn't override authorization)
      expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenantA,
          provider: 'twilio',
          providerCallId: 'call-123',
        },
        data: expect.objectContaining({
          providerStatus: 'completed',
          durationSec: 120,
        }),
      });
    });
  });

  describe('Execution Events', () => {
    it('should create execution events with idempotency', async () => {
      const eventData = {
        tenantId: tenantA,
        attemptId: 'attempt-1',
        eventType: 'attempt.started',
        payloadJson: { test: 'data' },
        correlationId,
        idempotencyKey: 'event-key',
      };

      await voiceAttemptRepository.createExecutionEvent(eventData);

      expect(mockPrisma.voiceExecutionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: tenantA,
          attemptId: 'attempt-1',
          eventType: 'attempt.started',
          payloadJson: { test: 'data' },
          correlationId,
          idempotencyKey: 'event-key',
        }),
      });
    });

    it('should handle duplicate execution events idempotently', async () => {
      mockPrisma.voiceExecutionEvent.create.mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['tenantId', 'idempotencyKey'] },
      });

      const eventData = {
        tenantId: tenantA,
        attemptId: 'attempt-1',
        eventType: 'attempt.started',
        payloadJson: { test: 'data' },
        correlationId,
        idempotencyKey: 'duplicate-key',
      };

      // Should not throw
      await expect(
        voiceAttemptRepository.createExecutionEvent(eventData)
      ).resolves.not.toThrow();
    });
  });

  describe('Boundary Enforcement', () => {
    it('should only authorize attempts that are INITIATED or PENDING', async () => {
      mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 0 }); // No rows updated

      await voiceAttemptRepository.authorizeAttempt(
        tenantA,
        'attempt-1',
        'consent-123',
        'payment-456',
        correlationId
      );

      // Verify the WHERE clause restricts authorization to appropriate statuses
      expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenantA,
          attemptId: 'attempt-1',
          status: { in: ['INITIATED', 'PENDING'] }, // Critical: only these can be authorized
        },
        data: expect.any(Object),
      });
    });

    it('should only link to case when attempt is AUTHORIZED', async () => {
      mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 0 }); // No rows updated

      await voiceAttemptRepository.linkToCase(tenantA, 'attempt-1', 'case-123');

      // Verify the WHERE clause restricts case linking to AUTHORIZED attempts
      expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenantA,
          attemptId: 'attempt-1',
          status: 'AUTHORIZED', // Critical: only AUTHORIZED attempts can be linked to cases
        },
        data: expect.objectContaining({
          caseRef: 'case-123',
        }),
      });
    });

    it('should use tenant-scoped provider deduplication', async () => {
      // Verify webhook updates use tenant + provider + providerCallId for deduplication
      mockPrisma.voiceAttempt.updateMany.mockResolvedValue({ count: 1 });

      const updateData = {
        tenantId: tenantA,
        provider: 'twilio',
        providerCallId: 'call-123',
        providerStatus: 'completed',
        correlationId,
      };

      await voiceAttemptRepository.updateFromProvider(updateData);

      expect(mockPrisma.voiceAttempt.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenantA, // Tenant isolation
          provider: 'twilio', // Provider namespace
          providerCallId: 'call-123', // Provider's unique call ID
        },
        data: expect.any(Object),
      });
    });
  });

  describe('Statistics and Monitoring', () => {
    it('should provide comprehensive attempt statistics', async () => {
      mockPrisma.voiceAttempt.groupBy.mockResolvedValue([
        { status: 'AUTHORIZED', _count: { status: 5 } },
        { status: 'COMPLETED', _count: { status: 10 } },
        { status: 'FAILED', _count: { status: 2 } },
        { status: 'CANCELLED', _count: { status: 1 } },
      ]);

      const stats = await voiceAttemptRepository.getAttemptStats();

      expect(stats.authorized).toBe(5);
      expect(stats.completed).toBe(10);
      expect(stats.failed).toBe(2);
      expect(stats.cancelled).toBe(1);
      expect(stats.total).toBe(18);
    });

    it('should filter statistics by tenant when specified', async () => {
      mockPrisma.voiceAttempt.groupBy.mockResolvedValue([
        { status: 'COMPLETED', _count: { status: 3 } },
      ]);

      const stats = await voiceAttemptRepository.getAttemptStats(tenantA);

      expect(mockPrisma.voiceAttempt.groupBy).toHaveBeenCalledWith({
        by: ['status'],
        where: { tenantId: tenantA },
        _count: { status: true },
      });
    });
  });

  describe('Event Publishing Integration', () => {
    it('should publish durable events for attempt lifecycle', async () => {
      // Test that events are published via the durable event publisher
      const mockAttempts = [
        {
          id: 'attempt-1',
          tenantId: tenantA,
          attemptId: 'attempt-1',
          leadId: 'lead-1',
          intentType: 'outbound_call_inbound',
          correlationId,
          attempts: 1,
          maxRetries: 3,
        },
      ];

      mockPrisma.$queryRaw.mockResolvedValue(mockAttempts);

      await voiceAttemptRunner.processNow();

      // Verify retry event was published durably
      expect(durableEventPublisher.publishAsync).toHaveBeenCalledWith({
        tenantId: tenantA,
        eventId: expect.any(String),
        eventType: 'voice.attempt.retry',
        payload: expect.any(Object),
        correlationId,
        idempotencyKey: expect.stringContaining('voice-retry'),
        sourceService: 'voice-attempt-runner',
      });
    });
  });
});
