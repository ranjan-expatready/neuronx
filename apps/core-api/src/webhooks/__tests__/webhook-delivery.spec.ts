/**
 * Webhook Delivery Tests - WI-018: Outbound Webhook Delivery System
 *
 * Tests for tenant-isolated, durable webhook delivery with HMAC signing and retry logic.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { WebhookRepository } from '../webhook.repository';
import { WebhookDispatcher } from '../webhook.dispatcher';
import { WebhookSigner } from '../webhook.signer';
import { WebhookService } from '../webhook.service';

// Mock Prisma
const mockPrisma = {
  webhookEndpoint: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  webhookDelivery: {
    create: jest.fn(),
    updateMany: jest.fn(),
    findMany: jest.fn(),
    deleteMany: jest.fn(),
    groupBy: jest.fn(),
  },
  webhookAttempt: {
    create: jest.fn(),
  },
  outboxEvent: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  $queryRaw: jest.fn(),
};

describe('Webhook Delivery System (WI-018)', () => {
  let app: INestApplication;
  let webhookRepository: WebhookRepository;
  let webhookDispatcher: WebhookDispatcher;
  let webhookSigner: WebhookSigner;
  let webhookService: WebhookService;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const correlationId = 'corr-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRepository,
        WebhookDispatcher,
        WebhookSigner,
        WebhookService,
      ],
    }).compile();

    webhookRepository = module.get<WebhookRepository>(WebhookRepository);
    webhookDispatcher = module.get<WebhookDispatcher>(WebhookDispatcher);
    webhookSigner = module.get<WebhookSigner>(WebhookSigner);
    webhookService = module.get<WebhookService>(WebhookService);

    app = module.createNestApplication();
    await app.init();

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockPrisma.webhookEndpoint.create.mockResolvedValue({ id: 'endpoint-1' });
    mockPrisma.webhookDelivery.create.mockResolvedValue({ id: 'delivery-1' });
    mockPrisma.webhookAttempt.create.mockResolvedValue({ id: 'attempt-1' });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);
    mockPrisma.outboxEvent.findUnique.mockResolvedValue(null);
    mockPrisma.$queryRaw.mockResolvedValue([]);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('WebhookSigner', () => {
    it('should generate HMAC SHA256 signature', () => {
      const payload = {
        eventType: 'payment.paid',
        eventId: 'event-1',
        occurredAt: '2024-01-01T00:00:00Z',
        payload: { amount: 100 },
        tenantId: tenantA,
        correlationId,
        deliveryId: 'delivery-1',
        attemptNumber: 1,
      };

      const secret = 'test-secret';
      const timestamp = '1640995200'; // 2022-01-01 00:00:00

      const signature = webhookSigner.signPayload(payload, secret, timestamp);

      expect(signature).toMatch(/^sha256=[a-f0-9]+$/);
    });

    it('should verify signatures correctly', () => {
      const payload = {
        eventType: 'payment.paid',
        eventId: 'event-1',
        occurredAt: '2024-01-01T00:00:00Z',
        payload: { amount: 100 },
        tenantId: tenantA,
        correlationId,
        deliveryId: 'delivery-1',
        attemptNumber: 1,
      };

      const secret = 'test-secret';
      const timestamp = '1640995200';

      const signature = webhookSigner.signPayload(payload, secret, timestamp);
      const isValid = webhookSigner.verifySignature(
        payload,
        secret,
        timestamp,
        signature
      );

      expect(isValid).toBe(true);
    });

    it('should reject invalid signatures', () => {
      const payload = {
        eventType: 'payment.paid',
        eventId: 'event-1',
        occurredAt: '2024-01-01T00:00:00Z',
        payload: { amount: 100 },
        tenantId: tenantA,
        correlationId,
        deliveryId: 'delivery-1',
        attemptNumber: 1,
      };

      const secret = 'test-secret';
      const timestamp = '1640995200';
      const wrongSignature = 'sha256=wrongsignature';

      const isValid = webhookSigner.verifySignature(
        payload,
        secret,
        timestamp,
        wrongSignature
      );

      expect(isValid).toBe(false);
    });

    it('should create signed headers', () => {
      const payload = {
        eventType: 'payment.paid',
        eventId: 'event-1',
        occurredAt: '2024-01-01T00:00:00Z',
        payload: { amount: 100 },
        tenantId: tenantA,
        correlationId,
        deliveryId: 'delivery-1',
        attemptNumber: 1,
      };

      const secret = 'test-secret';

      const { headers, timestamp } = webhookSigner.createSignedHeaders(
        payload,
        secret,
        'delivery-1'
      );

      expect(headers['X-Webhook-Signature']).toMatch(/^sha256=[a-f0-9]+$/);
      expect(headers['X-Webhook-Timestamp']).toBe(timestamp);
      expect(headers['X-Webhook-Event']).toBe('payment.paid');
      expect(headers['X-Webhook-Delivery-Id']).toBe('delivery-1');
      expect(headers['X-Tenant-Id']).toBe(tenantA);
      expect(headers['X-Correlation-Id']).toBe(correlationId);
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['User-Agent']).toBe('NeuronX-Webhook-Delivery/1.0');
    });
  });

  describe('WebhookRepository', () => {
    describe('createEndpoint', () => {
      it('should create webhook endpoint', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          eventTypes: ['payment.paid'],
        };

        const endpointId = await webhookRepository.createEndpoint(request);

        expect(endpointId).toBe('endpoint-1');
        expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: tenantA,
            name: 'Test Endpoint',
            url: 'https://example.com/webhook',
            secret: 'test-secret',
            eventTypes: ['payment.paid'],
          }),
        });
      });

      it('should reject invalid URLs', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'not-a-url',
          secret: 'test-secret',
          eventTypes: ['payment.paid'],
        };

        await expect(
          webhookRepository.createEndpoint(request)
        ).rejects.toThrow();
      });

      it('should reject non-HTTPS URLs', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'http://example.com/webhook',
          secret: 'test-secret',
          eventTypes: ['payment.paid'],
        };

        await expect(
          webhookRepository.createEndpoint(request)
        ).rejects.toThrow();
      });
    });

    describe('createDelivery', () => {
      it('should create webhook delivery (idempotent)', async () => {
        mockPrisma.webhookDelivery.create.mockResolvedValue({
          id: 'delivery-1',
        });

        const deliveryId = await webhookRepository.createDelivery(
          tenantA,
          'endpoint-1',
          'outbox-1',
          'payment.paid',
          correlationId
        );

        expect(deliveryId).toBe('delivery-1');
        expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            tenantId: tenantA,
            endpointId: 'endpoint-1',
            outboxEventId: 'outbox-1',
            outboxEventType: 'payment.paid',
            correlationId,
          }),
        });
      });

      it('should return null for duplicate deliveries', async () => {
        // Simulate unique constraint violation
        mockPrisma.webhookDelivery.create.mockRejectedValueOnce({
          code: 'P2002',
          meta: { target: ['tenantId', 'endpointId', 'outboxEventId'] },
        });

        const deliveryId = await webhookRepository.createDelivery(
          tenantA,
          'endpoint-1',
          'outbox-1',
          'payment.paid',
          correlationId
        );

        expect(deliveryId).toBeNull();
      });
    });

    describe('claimPendingDeliveries', () => {
      it('should claim deliveries with SKIP LOCKED for multi-instance safety', async () => {
        const mockDeliveries = [
          {
            id: 'delivery-1',
            tenantId: tenantA,
            endpointId: 'endpoint-1',
            outboxEventId: 'outbox-1',
            outboxEventType: 'payment.paid',
            correlationId,
            attempts: 1,
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockDeliveries);

        const deliveries = await webhookRepository.claimPendingDeliveries(10);

        expect(deliveries).toHaveLength(1);
        expect(deliveries[0].id).toBe('delivery-1');
        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });
    });

    describe('Tenant Isolation', () => {
      it('should only return endpoints for requested tenant', async () => {
        const tenantAEndpoints = [
          {
            id: 'a-1',
            tenantId: tenantA,
            name: 'Endpoint A',
            enabled: true,
            eventTypes: ['payment.paid'],
          },
        ];

        const tenantBEndpoints = [
          {
            id: 'b-1',
            tenantId: tenantB,
            name: 'Endpoint B',
            enabled: true,
            eventTypes: ['payment.paid'],
          },
        ];

        mockPrisma.webhookEndpoint.findMany.mockImplementation(args => {
          const tenantId = args.where.tenantId;
          return Promise.resolve(
            tenantId === tenantA ? tenantAEndpoints : tenantBEndpoints
          );
        });

        const resultA = await webhookRepository.listActiveEndpoints(tenantA);
        const resultB = await webhookRepository.listActiveEndpoints(tenantB);

        expect(resultA).toHaveLength(1);
        expect(resultA[0].tenantId).toBe(tenantA);
        expect(resultB).toHaveLength(1);
        expect(resultB[0].tenantId).toBe(tenantB);
      });
    });
  });

  describe('WebhookDispatcher', () => {
    describe('processPendingDeliveries', () => {
      it('should process claimed deliveries and send webhooks', async () => {
        // Mock outbox event
        mockPrisma.outboxEvent.findUnique.mockResolvedValue({
          id: 'outbox-1',
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          createdAt: new Date(),
        });

        // Mock endpoint
        mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({
          id: 'endpoint-1',
          tenantId: tenantA,
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          enabled: true,
          eventTypes: ['payment.paid'],
          timeoutMs: 5000,
          maxAttempts: 10,
          backoffBaseSeconds: 30,
        });

        const mockDeliveries = [
          {
            id: 'delivery-1',
            tenantId: tenantA,
            endpointId: 'endpoint-1',
            outboxEventId: 'outbox-1',
            outboxEventType: 'payment.paid',
            correlationId,
            attempts: 1,
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockDeliveries);

        // Mock successful HTTP request
        global.fetch = jest.fn().mockResolvedValue({
          ok: true,
          status: 200,
          text: jest.fn().mockResolvedValue('OK'),
        });

        const processed = await webhookDispatcher.processNow();

        expect(processed).toBe(1);
        expect(mockPrisma.webhookDelivery.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: tenantA,
            id: 'delivery-1',
            status: 'SENDING',
          },
          data: {
            status: 'DELIVERED',
            updatedAt: expect.any(Date),
          },
        });

        expect(mockPrisma.webhookAttempt.create).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalledWith(
          'https://example.com/webhook',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'X-Webhook-Signature': expect.stringContaining('sha256='),
              'X-Webhook-Event': 'payment.paid',
              'X-Tenant-Id': tenantA,
            }),
            body: expect.stringContaining('"eventType":"payment.paid"'),
          })
        );
      });

      it('should handle webhook delivery failures with retry', async () => {
        // Mock outbox event
        mockPrisma.outboxEvent.findUnique.mockResolvedValue({
          id: 'outbox-1',
          eventId: 'event-1',
          eventType: 'payment.paid',
          payload: { amount: 100 },
          createdAt: new Date(),
        });

        // Mock endpoint
        mockPrisma.webhookEndpoint.findFirst.mockResolvedValue({
          id: 'endpoint-1',
          tenantId: tenantA,
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          enabled: true,
          eventTypes: ['payment.paid'],
          timeoutMs: 5000,
          maxAttempts: 10,
          backoffBaseSeconds: 30,
        });

        const mockDeliveries = [
          {
            id: 'delivery-1',
            tenantId: tenantA,
            endpointId: 'endpoint-1',
            outboxEventId: 'outbox-1',
            outboxEventType: 'payment.paid',
            correlationId,
            attempts: 2, // Less than max attempts
            nextAttemptAt: new Date(),
          },
        ];

        mockPrisma.$queryRaw.mockResolvedValue(mockDeliveries);

        // Mock failed HTTP request
        global.fetch = jest
          .fn()
          .mockRejectedValue(new Error('Connection failed'));

        const processed = await webhookDispatcher.processNow();

        expect(processed).toBe(0); // Failed delivery doesn't count as processed
        expect(mockPrisma.webhookDelivery.updateMany).toHaveBeenCalledWith({
          where: {
            tenantId: tenantA,
            id: 'delivery-1',
            status: 'SENDING',
          },
          data: expect.objectContaining({
            status: 'FAILED',
            lastError: 'Connection failed',
          }),
        });
      });
    });

    describe('Multi-Instance Safety', () => {
      it('should prevent concurrent execution', async () => {
        // Simulate dispatcher already running
        (webhookDispatcher as any).isRunning = true;

        const processed = await webhookDispatcher.processNow();

        expect(processed).toBe(0);
        expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
      });

      it('should use SKIP LOCKED for database-level concurrency control', async () => {
        mockPrisma.$queryRaw.mockResolvedValue([]);

        await webhookDispatcher.processNow();

        expect(mockPrisma.$queryRaw).toHaveBeenCalledWith(
          expect.stringContaining('SKIP LOCKED')
        );
      });
    });
  });

  describe('WebhookService', () => {
    describe('createEndpoint', () => {
      it('should create webhook endpoint with validation', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          eventTypes: ['payment.paid'],
        };

        const endpointId = await webhookService.createEndpoint(request);

        expect(endpointId).toBe('endpoint-1');
        expect(mockPrisma.webhookEndpoint.create).toHaveBeenCalled();
      });

      it('should reject invalid URLs', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'not-a-url',
          secret: 'test-secret',
          eventTypes: ['payment.paid'],
        };

        await expect(webhookService.createEndpoint(request)).rejects.toThrow(
          'Invalid URL format'
        );
      });

      it('should reject non-HTTPS URLs', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'http://example.com/webhook',
          secret: 'test-secret',
          eventTypes: ['payment.paid'],
        };

        await expect(webhookService.createEndpoint(request)).rejects.toThrow(
          'Webhook endpoints must use HTTPS'
        );
      });

      it('should reject invalid event types', async () => {
        const request = {
          tenantId: tenantA,
          name: 'Test Endpoint',
          url: 'https://example.com/webhook',
          secret: 'test-secret',
          eventTypes: ['invalid.event.type'],
        };

        await expect(webhookService.createEndpoint(request)).rejects.toThrow(
          'Invalid event type'
        );
      });
    });
  });

  describe('Delivery Fanout', () => {
    it('should create deliveries for published outbox events', async () => {
      // Mock published outbox events
      const publishedEvents = [
        {
          id: 'outbox-1',
          tenantId: tenantA,
          eventType: 'payment.paid',
          eventId: 'event-1',
          correlationId,
          createdAt: new Date(),
        },
        {
          id: 'outbox-2',
          tenantId: tenantA,
          eventType: 'sla.timer.due',
          eventId: 'event-2',
          correlationId: null,
          createdAt: new Date(),
        },
      ];

      mockPrisma.outboxEvent.findMany.mockResolvedValue(publishedEvents);

      // Mock endpoints
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
        {
          id: 'endpoint-1',
          tenantId: tenantA,
          name: 'Payment Endpoint',
          url: 'https://example.com/payments',
          secret: 'secret-1',
          enabled: true,
          eventTypes: ['payment.paid'],
        },
        {
          id: 'endpoint-2',
          tenantId: tenantA,
          name: 'SLA Endpoint',
          url: 'https://example.com/sla',
          secret: 'secret-2',
          enabled: true,
          eventTypes: ['sla.timer.due'],
        },
      ]);

      const deliveriesCreated =
        await webhookRepository.createDeliveriesForPublishedEvents();

      expect(deliveriesCreated).toBe(2); // One for each event-endpoint match
      expect(mockPrisma.webhookDelivery.create).toHaveBeenCalledTimes(2);
    });

    it('should handle fanout idempotently', async () => {
      // Simulate existing deliveries (should not create duplicates)
      mockPrisma.webhookDelivery.create.mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['tenantId', 'endpointId', 'outboxEventId'] },
      });

      const publishedEvents = [
        {
          id: 'outbox-1',
          tenantId: tenantA,
          eventType: 'payment.paid',
          eventId: 'event-1',
          correlationId,
          createdAt: new Date(),
        },
      ];

      mockPrisma.outboxEvent.findMany.mockResolvedValue(publishedEvents);
      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
        {
          id: 'endpoint-1',
          tenantId: tenantA,
          name: 'Payment Endpoint',
          url: 'https://example.com/payments',
          secret: 'secret-1',
          enabled: true,
          eventTypes: ['payment.paid'],
        },
      ]);

      const deliveriesCreated =
        await webhookRepository.createDeliveriesForPublishedEvents();

      expect(deliveriesCreated).toBe(0); // Duplicate ignored
    });
  });

  describe('Integration Scenarios', () => {
    it('should maintain end-to-end delivery flow', async () => {
      // Mock complete flow: outbox event -> delivery creation -> processing -> success

      // 1. Setup outbox event
      const outboxEvent = {
        id: 'outbox-1',
        eventId: 'event-1',
        eventType: 'payment.paid',
        payload: { amount: 100, currency: 'USD' },
        tenantId: tenantA,
        correlationId,
        createdAt: new Date(),
      };

      mockPrisma.outboxEvent.findMany.mockResolvedValue([outboxEvent]);
      mockPrisma.outboxEvent.findUnique.mockResolvedValue(outboxEvent);

      // 2. Setup endpoint
      const endpoint = {
        id: 'endpoint-1',
        tenantId: tenantA,
        name: 'Payment Webhook',
        url: 'https://example.com/webhook',
        secret: 'test-secret',
        enabled: true,
        eventTypes: ['payment.paid'],
        timeoutMs: 5000,
        maxAttempts: 10,
        backoffBaseSeconds: 30,
      };

      mockPrisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);
      mockPrisma.webhookEndpoint.findFirst.mockResolvedValue(endpoint);

      // 3. Setup delivery claim
      const delivery = {
        id: 'delivery-1',
        tenantId: tenantA,
        endpointId: 'endpoint-1',
        outboxEventId: 'outbox-1',
        outboxEventType: 'payment.paid',
        correlationId,
        attempts: 1,
        nextAttemptAt: new Date(),
      };

      mockPrisma.$queryRaw.mockResolvedValue([delivery]);

      // 4. Mock successful HTTP delivery
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: jest.fn().mockResolvedValue('OK'),
      });

      // Execute end-to-end flow
      const deliveriesCreated =
        await webhookRepository.createDeliveriesForPublishedEvents();
      expect(deliveriesCreated).toBe(1);

      const processed = await webhookDispatcher.processNow();
      expect(processed).toBe(1);

      // Verify delivery was marked as completed
      expect(mockPrisma.webhookDelivery.updateMany).toHaveBeenCalledWith({
        where: {
          tenantId: tenantA,
          id: 'delivery-1',
          status: 'SENDING',
        },
        data: {
          status: 'DELIVERED',
          updatedAt: expect.any(Date),
        },
      });

      // Verify attempt was recorded
      expect(mockPrisma.webhookAttempt.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: tenantA,
          deliveryId: 'delivery-1',
          attemptNumber: 1,
          responseStatus: 200,
          durationMs: expect.any(Number),
        }),
      });
    });
  });
});
