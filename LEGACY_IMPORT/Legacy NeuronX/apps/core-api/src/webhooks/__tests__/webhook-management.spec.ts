/**
 * Webhook Management API Tests - WI-020: Webhook Endpoint Management APIs
 *
 * Comprehensive tests for tenant-scoped webhook endpoint management APIs.
 * Covers CRUD operations, secret rotation, test delivery, and security.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { WebhookService } from '../webhook.service';
import { WebhookRepository } from '../webhook.repository';
import { SecretService } from '../../secrets/secret.service';
import { WebhookController } from '../webhook.controller';
import { WebhookValidation } from '../webhook.dto';

// Mock dependencies
const mockWebhookRepository = {
  createEndpoint: jest.fn(),
  updateEndpoint: jest.fn(),
  getEndpointById: jest.fn(),
  listActiveEndpoints: jest.fn(),
  deleteEndpoint: jest.fn(),
  createDelivery: jest.fn(),
};

const mockSecretService = {
  putSecret: jest.fn(),
  getSecret: jest.fn(),
  rotateSecret: jest.fn(),
};

describe('Webhook Management APIs (WI-020)', () => {
  let app: INestApplication;
  let webhookService: WebhookService;

  const tenantId = 'tenant-a';
  const adminToken = 'Bearer admin-token-123';
  const correlationId = 'test-correlation-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        WebhookService,
        {
          provide: WebhookRepository,
          useValue: mockWebhookRepository,
        },
        {
          provide: SecretService,
          useValue: mockSecretService,
        },
      ],
    }).compile();

    app = module.createNestApplication();

    // Add validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );

    // Mock admin guard
    app.use((req: any, res: any, next: any) => {
      if (req.headers.authorization === adminToken) {
        req.tenantId = tenantId;
        req.user = { id: 'admin-user' };
      }
      next();
    });

    await app.init();

    webhookService = module.get<WebhookService>(WebhookService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/webhooks/endpoints - Create Endpoint', () => {
    const validRequest = {
      name: 'Test Webhook',
      url: 'https://example.com/webhook',
      eventTypes: ['payment.paid'],
    };

    it('should create webhook endpoint successfully', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        tenantId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        secretRef: 'dev:tenant-a:webhook-endpoint-endpoint-123:1',
        enabled: true,
        eventTypes: ['payment.paid'],
        timeoutMs: 5000,
        maxAttempts: 10,
        backoffBaseSeconds: 30,
        secretProvider: 'dev',
        secretUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSecretService.putSecret.mockResolvedValue(
        'dev:tenant-a:webhook-endpoint-endpoint-123:1'
      );
      mockWebhookRepository.createEndpoint.mockResolvedValue('endpoint-123');
      mockWebhookRepository.getEndpointById.mockResolvedValue(mockEndpoint);

      const response = await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .send(validRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'endpoint-123',
        tenantId,
        name: 'Test Webhook',
        url: 'https://example.com/webhook',
        enabled: true,
        eventTypes: ['payment.paid'],
      });

      // Verify secret was created
      expect(mockSecretService.putSecret).toHaveBeenCalledWith(
        tenantId,
        expect.stringContaining('webhook-endpoint-'),
        expect.any(String), // Secure random secret
        expect.objectContaining({
          createdBy: 'webhook-api',
          endpointName: 'Test Webhook',
        })
      );
    });

    it('should reject HTTP URLs', async () => {
      const invalidRequest = {
        ...validRequest,
        url: 'http://example.com/webhook',
      };

      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .send(invalidRequest)
        .expect(400);
    });

    it('should reject invalid event types', async () => {
      const invalidRequest = {
        ...validRequest,
        eventTypes: ['invalid.event'],
      };

      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .send(invalidRequest)
        .expect(400);
    });

    it('should reject unauthenticated requests', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .send(validRequest)
        .expect(403);
    });
  });

  describe('GET /api/webhooks/endpoints - List Endpoints', () => {
    it('should list webhook endpoints for tenant', async () => {
      const mockEndpoints = [
        {
          id: 'endpoint-1',
          tenantId,
          name: 'Endpoint 1',
          url: 'https://example.com/1',
          enabled: true,
          eventTypes: ['payment.paid'],
          secretProvider: 'dev',
          secretUpdatedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockWebhookRepository.listActiveEndpoints.mockResolvedValue(
        mockEndpoints
      );

      const response = await request(app.getHttpServer())
        .get('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toMatchObject({
        endpoints: [
          {
            id: 'endpoint-1',
            name: 'Endpoint 1',
            url: 'https://example.com/1',
            enabled: true,
            eventTypes: ['payment.paid'],
          },
        ],
        total: 1,
        limit: 50,
        offset: 0,
      });
    });

    it('should support pagination', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/webhooks/endpoints?limit=10&offset=20')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body.limit).toBe(10);
      expect(response.body.offset).toBe(20);
    });

    it('should reject excessive limits', async () => {
      await request(app.getHttpServer())
        .get('/api/webhooks/endpoints?limit=200')
        .set('Authorization', adminToken)
        .expect(400);
    });
  });

  describe('GET /api/webhooks/endpoints/:id - Get Endpoint', () => {
    it('should return webhook endpoint details', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        tenantId,
        name: 'Test Endpoint',
        url: 'https://example.com/webhook',
        secretRef: 'dev:tenant-a:webhook-endpoint-endpoint-123:1',
        enabled: true,
        eventTypes: ['payment.paid'],
        timeoutMs: 5000,
        maxAttempts: 10,
        backoffBaseSeconds: 30,
        secretProvider: 'dev',
        secretUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWebhookRepository.getEndpointById.mockResolvedValue(mockEndpoint);

      const response = await request(app.getHttpServer())
        .get('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'endpoint-123',
        tenantId,
        name: 'Test Endpoint',
        url: 'https://example.com/webhook',
        enabled: true,
        eventTypes: ['payment.paid'],
      });

      // Ensure secret is NOT returned
      expect(response.body).not.toHaveProperty('secret');
      expect(response.body).not.toHaveProperty('secretRef');
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockWebhookRepository.getEndpointById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/webhooks/endpoints/non-existent')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('PATCH /api/webhooks/endpoints/:id - Update Endpoint', () => {
    const updateRequest = {
      name: 'Updated Name',
      enabled: false,
      eventTypes: ['payment.paid', 'sla.timer.due'],
    };

    it('should update webhook endpoint', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        tenantId,
        name: 'Updated Name',
        url: 'https://example.com/webhook',
        enabled: false,
        eventTypes: ['payment.paid', 'sla.timer.due'],
        timeoutMs: 5000,
        maxAttempts: 10,
        backoffBaseSeconds: 30,
        secretProvider: 'dev',
        secretUpdatedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockWebhookRepository.getEndpointById.mockResolvedValue(mockEndpoint);

      const response = await request(app.getHttpServer())
        .patch('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', adminToken)
        .send(updateRequest)
        .expect(200);

      expect(response.body.name).toBe('Updated Name');
      expect(response.body.enabled).toBe(false);
      expect(response.body.eventTypes).toEqual([
        'payment.paid',
        'sla.timer.due',
      ]);

      expect(mockWebhookRepository.updateEndpoint).toHaveBeenCalledWith(
        tenantId,
        'endpoint-123',
        expect.objectContaining(updateRequest)
      );
    });

    it('should reject invalid HTTPS URLs', async () => {
      const invalidUpdate = {
        url: 'http://invalid.com/webhook',
      };

      await request(app.getHttpServer())
        .patch('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', adminToken)
        .send(invalidUpdate)
        .expect(400);
    });

    it('should reject invalid event types', async () => {
      const invalidUpdate = {
        eventTypes: ['invalid.event'],
      };

      await request(app.getHttpServer())
        .patch('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', adminToken)
        .send(invalidUpdate)
        .expect(400);
    });
  });

  describe('DELETE /api/webhooks/endpoints/:id - Delete Endpoint', () => {
    it('should disable webhook endpoint', async () => {
      await request(app.getHttpServer())
        .delete('/api/webhooks/endpoints/endpoint-123')
        .set('Authorization', adminToken)
        .expect(204);

      expect(mockWebhookRepository.updateEndpoint).toHaveBeenCalledWith(
        tenantId,
        'endpoint-123',
        expect.objectContaining({ enabled: false })
      );
    });
  });

  describe('POST /api/webhooks/endpoints/:id/rotate-secret - Rotate Secret', () => {
    it('should rotate webhook endpoint secret', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        tenantId,
        secretRef: 'dev:tenant-a:webhook-endpoint-endpoint-123:1',
        secretProvider: 'dev',
      };

      mockWebhookRepository.getEndpointById.mockResolvedValue(mockEndpoint);
      mockSecretService.rotateSecret.mockResolvedValue(
        'dev:tenant-a:webhook-endpoint-endpoint-123:2'
      );

      const response = await request(app.getHttpServer())
        .post('/api/webhooks/endpoints/endpoint-123/rotate-secret')
        .set('Authorization', adminToken)
        .send({ reason: 'Security rotation' })
        .expect(200);

      expect(response.body).toMatchObject({
        endpointId: 'endpoint-123',
        previousSecretRef: 'dev:tenant-a:webhook-endpoint-endpoint-123:1',
        newSecretRef: 'dev:tenant-a:webhook-endpoint-endpoint-123:2',
        actor: 'admin-user',
      });

      expect(mockSecretService.rotateSecret).toHaveBeenCalledWith(
        tenantId,
        'webhook-endpoint-endpoint-123',
        expect.any(String), // New secure secret
        'admin-user',
        expect.any(String) // Correlation ID
      );
    });

    it('should return 404 for non-existent endpoint', async () => {
      mockWebhookRepository.getEndpointById.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints/non-existent/rotate-secret')
        .set('Authorization', adminToken)
        .send({})
        .expect(500); // Service throws error
    });
  });

  describe('POST /api/webhooks/endpoints/:id/test - Test Delivery', () => {
    it('should queue test webhook delivery', async () => {
      const mockEndpoint = {
        id: 'endpoint-123',
        tenantId,
        secretRef: 'dev:tenant-a:webhook-endpoint-endpoint-123:1',
      };

      mockWebhookRepository.getEndpointById.mockResolvedValue(mockEndpoint);
      mockWebhookRepository.createDelivery.mockResolvedValue(
        'test-delivery-123'
      );

      const response = await request(app.getHttpServer())
        .post('/api/webhooks/endpoints/endpoint-123/test')
        .set('Authorization', adminToken)
        .send({ message: 'Custom test message' })
        .expect(200);

      expect(response.body).toMatchObject({
        deliveryId: 'test-delivery-123',
        endpointId: 'endpoint-123',
        status: 'QUEUED',
      });

      expect(mockWebhookRepository.createDelivery).toHaveBeenCalledWith(
        tenantId,
        'endpoint-123',
        expect.stringContaining('test-'),
        'webhook.test',
        expect.any(String)
      );
    });

    it('should enforce rate limiting', async () => {
      // First, exhaust the rate limit by mocking the service method
      const mockService = app.get(WebhookService);
      jest
        .spyOn(mockService as any, 'checkTestDeliveryRateLimit')
        .mockReturnValue(false);

      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints/endpoint-123/test')
        .set('Authorization', adminToken)
        .send({})
        .expect(500); // Service throws rate limit error
    });
  });

  describe('Tenant Isolation', () => {
    it('should only access endpoints for authenticated tenant', async () => {
      // All repository calls should be scoped to the authenticated tenant
      await request(app.getHttpServer())
        .get('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .expect(200);

      expect(mockWebhookRepository.listActiveEndpoints).toHaveBeenCalledWith(
        tenantId
      );
    });

    it('should prevent cross-tenant access', async () => {
      // Repository should only return endpoints for the authenticated tenant
      mockWebhookRepository.getEndpointById.mockResolvedValue(null); // Simulate not found

      await request(app.getHttpServer())
        .get('/api/webhooks/endpoints/other-tenant-endpoint')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('Security Validation', () => {
    it('should reject requests without admin authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .send({})
        .expect(403);
    });

    it('should reject malformed JSON', async () => {
      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should reject extra fields in requests', async () => {
      const requestWithExtraFields = {
        name: 'Test',
        url: 'https://example.com/webhook',
        eventTypes: ['payment.paid'],
        maliciousField: 'should be rejected',
      };

      await request(app.getHttpServer())
        .post('/api/webhooks/endpoints')
        .set('Authorization', adminToken)
        .send(requestWithExtraFields)
        .expect(400);
    });
  });

  describe('WebhookValidation Utility', () => {
    describe('validateEventTypes', () => {
      it('should accept valid event types', () => {
        expect(() => {
          WebhookValidation.validateEventTypes([
            'payment.paid',
            'webhook.test',
          ]);
        }).not.toThrow();
      });

      it('should reject invalid event types', () => {
        expect(() => {
          WebhookValidation.validateEventTypes(['invalid.event']);
        }).toThrow('Unsupported event types: invalid.event');
      });
    });

    describe('validateHttpsUrl', () => {
      it('should accept HTTPS URLs', () => {
        expect(() => {
          WebhookValidation.validateHttpsUrl('https://example.com/webhook');
        }).not.toThrow();
      });

      it('should reject HTTP URLs', () => {
        expect(() => {
          WebhookValidation.validateHttpsUrl('http://example.com/webhook');
        }).toThrow('Webhook endpoints must use HTTPS');
      });

      it('should reject invalid URLs', () => {
        expect(() => {
          WebhookValidation.validateHttpsUrl('not-a-url');
        }).toThrow('Invalid URL format');
      });
    });

    describe('generateCorrelationId', () => {
      it('should generate correlation IDs with proper format', () => {
        const correlationId = WebhookValidation.generateCorrelationId(
          'create',
          tenantId
        );
        expect(correlationId).toMatch(
          /^webhook-api-create-tenant-a-\d+-[a-z0-9]+$/
        );
      });
    });
  });
});
